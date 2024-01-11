// telegram.service.ts
import { Injectable } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { HttpService } from '@nestjs/axios';

import { catchError, firstValueFrom, map } from 'rxjs';

import dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class TelegramService {

  constructor(private httpService: HttpService) {
    this.sendMessage('PhunkBot started');
  }

  private readonly botToken = process.env.TELEGRAM_BOT_TOKEN;
  private readonly chatId = '5445160677';

  async sendMessage(message: string): Promise<AxiosResponse> {
    const apiUrl = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    const params = {
      chat_id: this.chatId,
      text: message,
    };

    return await firstValueFrom(
      this.httpService.post(apiUrl, params).pipe(
        map((response) => response.data),
        catchError((error) => {
          console.log(error);
          return error;
        }),
      )
    );
  }
}
