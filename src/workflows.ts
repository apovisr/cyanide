import { ApplicationFailure, CancellationScope, CancelledFailure, condition, defineSignal, defineUpdate, proxyActivities, setHandler, sleep } from '@temporalio/workflow';
// Only import the activity types
import type * as activities from './activities';
import { setPriority } from 'os';

const MAX_OTP_ATTEMPTS = 3;

// Timeout para activities
const { sendPhoneOtp, sendEmailOtp, createUserAccount } = proxyActivities<{
  sendPhoneOtp(phone: string): Promise<void>;
  sendEmailOtp(email: string): Promise<void>;
  createUserAccount(
    phone: string,
    email: string,
    password: string
  ): Promise<void>;
}>({
  startToCloseTimeout: '10s',
});

// ----------- SIGNAL DEFINITIONS -----------

export const enterPhoneUpdate = defineUpdate<void, [string]>('enter_phone');
export const requestPhoneOtpUpdate = defineUpdate('request_phone_otp');
export const verifyPhoneUpdate = defineUpdate('verify_phone');

export const enterEmailUpdate = defineUpdate<void, [string]>('enter_email');
export const requestEmailOtpUpdate = defineUpdate('request_email_otp');
export const verifyEmailUpdate = defineUpdate('verify_email');

export const enterPasswordUpdate = defineUpdate<void, [string]>('enter_password');
// ----------- WORKFLOW -----------



export async function example(): Promise<string> {
  let phone: string | undefined;
  let email: string | undefined;
  let password: string | undefined;

  let phoneVerified = false;
  let emailVerified = false;

  let phoneOtpAttempts = 0;
  let emailOtpAttempts = 0;

  // ----------- SIGNAL HANDLERS -----------

  setHandler(enterPhoneUpdate, (value: string) => {
    phone = value;
  }, {
    validator: (value: string) => {
      if(phone){
        throw ApplicationFailure.create({
          message: 'Teléfono ya ingresado',
          type: 'PhoneAlreadyEntered',
        });
      }
    },
  });

  setHandler(requestPhoneOtpUpdate, () => {
    phoneOtpAttempts++;
  }, {
    validator: () => {
      if (!phone) {
        throw ApplicationFailure.create({
          message: 'El celular debe ser ingresado antes de solicitar un OTP',
          type: 'PhoneNotEntered',
        });
      }
      if (phoneOtpAttempts >= MAX_OTP_ATTEMPTS  ) {
        throw ApplicationFailure.create({
          message: 'Límite de OTP por celular excedido',
          type: 'PhoneOtpAttemptsExceeded',
        });
      }
    }
  });

  setHandler(verifyPhoneUpdate, () => {
    phoneVerified = true;
  }, {
    validator: () => {
      if(!phone){
        throw ApplicationFailure.create({
          message: 'El celular debe ser ingresado antes de verificar OTP',
          type: 'PhoneNotEntered',
        });
      }
      if(phoneVerified){
        throw ApplicationFailure.create({
          message: 'El celular ya ha sido verificado',
          type: 'PhoneAlreadyVerified',
        });
      }
    }
  });

  setHandler(enterEmailUpdate, (value: string) => {
    email = value;
  }, {
    validator: (value: string) => {
      if(email){
        throw ApplicationFailure.create({
          message: 'Email ya ingresado',
          type: 'EmailAlreadyEntered',
        });
      }
    },
  });

  setHandler(requestEmailOtpUpdate, () => {
    emailOtpAttempts++;
  }, {
    validator: () => {
      if (!email) {
        throw ApplicationFailure.create({
          message: 'El email debe ser ingresado antes de solicitar un OTP',
          type: 'EmailNotEntered',
        });
      }
      if (emailOtpAttempts >= MAX_OTP_ATTEMPTS  ) {
        throw ApplicationFailure.create({
          message: 'Límite de OTP por email excedido',
          type: 'EmailOtpAttemptsExceeded',
        });
      }
    }
  });

  setHandler(verifyEmailUpdate, () => {
    emailVerified = true;
  }, {
    validator: () => {
      if(!email){
        throw ApplicationFailure.create({
          message: 'El email debe ser ingresado antes de verificar OTP',
          type: 'EmailNotEntered',
        });
      }
      if(emailVerified){
        throw ApplicationFailure.create({
          message: 'El email ya ha sido verificado',
          type: 'EmailAlreadyVerified',
        });
      }
    }
  });

  setHandler(enterPasswordUpdate, (value: string) => {
    password = value;
  }, {
    validator: (value: string) => {
      if (!value || value.length < 8) {
        throw ApplicationFailure.create({
          message: 'La contraseña debe tener al menos 8 caracteres',
          type: 'InvalidPasswordFormat',
        });
      }
    }
  });

  // ----------- FLOW -----------

  // 1️⃣ Esperar celular
  await condition(() => phone !== undefined);

  // 2️⃣ OTP celular con límite
  while (!phoneVerified) {
    await condition(() => phoneOtpAttempts >= 0);

    if (phoneOtpAttempts > MAX_OTP_ATTEMPTS) {
      throw new Error('Límite de OTP por celular excedido');
    }

    await sendPhoneOtp(phone!);

    await condition(
      () => phoneVerified || phoneOtpAttempts > 1
    );
  }

  // 3️⃣ Esperar email
  await condition(() => email !== undefined);

  // 4️⃣ OTP email con límite
  while (!emailVerified) {
    await condition(() => emailOtpAttempts >= 0);

    if (emailOtpAttempts > MAX_OTP_ATTEMPTS) {
      throw new Error('Límite de OTP por email excedido');
    }

    await sendEmailOtp(email!);

    await condition(
      () => emailVerified || emailOtpAttempts > 1
    );
  }

  // 5️⃣ Esperar contraseña
  await condition(() => password !== undefined);

  // 6️⃣ Crear cuenta
  await createUserAccount(phone!, email!, password!);

  return 'Cuenta creada exitosamente';
}