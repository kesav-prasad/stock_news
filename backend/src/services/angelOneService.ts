import fetch from 'node-fetch';
import { TOTP } from 'totp-generator';

const BASE_URL = 'https://apiconnect.angelbroking.com/rest';

interface AngelOneConfig {
  apiKey: string;
  clientId: string;
  pin: string;
  totpSecret: string;
}

export class AngelOneService {
  private config: AngelOneConfig;
  private jwtToken: string | null = null;
  private feedToken: string | null = null;
  private commonHeaders: Record<string, string>;

  constructor(config: AngelOneConfig) {
    this.config = config;
    this.commonHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-UserType': 'USER',
      'X-SourceID': 'WEB',
      'X-ClientLocalIP': '192.168.1.1',
      'X-ClientPublicIP': '1.1.1.1',
      'X-MACAddress': 'AA-BB-CC-DD-EE-FF',
      'X-PrivateKey': this.config.apiKey,
    };
  }

  /**
   * Generates TOTP using the secret key (v2 API is async)
   */
  private async generateTotp(): Promise<string> {
    const { otp } = await TOTP.generate(this.config.totpSecret);
    return otp;
  }

  /**
   * Logs into Angel One and stores the session tokens
   */
  async login(): Promise<void> {
    try {
      const totp = this.generateTotp();
      
      const response = await fetch(`${BASE_URL}/auth/angelbroking/user/v1/loginByPassword`, {
        method: 'POST',
        headers: this.commonHeaders,
        body: JSON.stringify({
          clientcode: this.config.clientId,
          password: this.config.pin,
          totp: totp,
        }),
      });

      const data: any = await response.json();

      if (data && data.status === true && data.data) {
        this.jwtToken = data.data.jwtToken;
        this.feedToken = data.data.feedToken;
        console.log('[Angel One] Successfully logged in! JWT token acquired.');
      } else {
        throw new Error(`Login failed: ${data?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[Angel One] Login Error:', error);
      throw error;
    }
  }

  /**
   * Fetches the portfolio holdings
   */
  async getHoldings(): Promise<any> {
    if (!this.jwtToken) {
      await this.login();
    }

    try {
      const response = await fetch(`${BASE_URL}/secure/angelbroking/portfolio/v1/getHolding`, {
        method: 'GET',
        headers: {
          ...this.commonHeaders,
          'Authorization': `Bearer ${this.jwtToken}`,
        },
      });

      const data: any = await response.json();
      
      if (data && data.status === true) {
        return data.data;
      } else if (data && data.errorcode === 'AG8001') {
        // Token expired, re-login and retry
        console.log('[Angel One] Token expired, attempting re-login...');
        await this.login();
        return this.getHoldings();
      } else {
        throw new Error(`Failed to fetch holdings: ${data?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[Angel One] Get Holdings Error:', error);
      throw error;
    }
  }
}
