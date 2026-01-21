import { randomInt } from 'crypto';

/**
 * A simple greeting activity used by the `example` workflow.
 */
export async function greet(name: string): Promise<string> {
  return `Hello, ${name}!`;
}

/**
 * Generate a random 6-digit numeric code as a string.
 * The result is zero-padded to ensure a length of 6 (e.g. "000123").
 */
export async function generateSixDigitCode(): Promise<string> {
  const n = randomInt(0, 1_000_000); // 0..999999
  return new Promise( resolve => resolve(n.toString().padStart(6, '0')) );
}

export async function sendNotification(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('Notification sent!');
}


// activities.ts
export async function sendPhoneOtp(phone: string): Promise<void> {
  console.log(`OTP enviado al celular ${phone}`);
}

export async function sendEmailOtp(email: string): Promise<void> {
  console.log(`OTP enviado al email ${email}`);
}

export async function createUserAccount(
  phone: string,
  email: string,
  password: string
): Promise<void> {
  console.log(`Cuenta creada: ${phone} | ${email}`);
}
