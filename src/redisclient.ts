import { Redis } from 'ioredis';

export class RedisClient{
    constructor(private readonly client: Redis){
        this.loadScripts();
    }

    async get(key: string): Promise<string | null>{
        return this.client.get(key);
    }

    async set(key: string, value: string, expireSeconds?: number): Promise<'OK' | null>{
        if(expireSeconds){
            return this.client.set(key, value, 'EX', expireSeconds);
        }
        return this.client.set(key, value);
    }


    private async loadScripts(){
        this.client.on('connect', async () => {
            try {
                const script = `
                    return redis.call('PING')
                `;
                await this.client.script('LOAD', script);
                console.log('Lua script loaded successfully.');
            } catch (error) {
                console.error('Error loading Lua script:', error);
            }
        });
    }
}