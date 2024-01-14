// telegram.service.ts
import { Injectable } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { HttpService } from '@nestjs/axios';

import { catchError, firstValueFrom, map } from 'rxjs';

import dotenv from 'dotenv';
import FormData from 'form-data';
dotenv.config();

@Injectable()
export class TelegramService {

  constructor(private httpSvc: HttpService) {
    // this.sendMessage('PhunkBot started');
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
      this.httpSvc.post(apiUrl, params).pipe(
        map((response) => response.data),
        catchError((error) => {
          console.log(error);
          return error;
        }),
      )
    );
  }

  async sendPhoto(image: Buffer, caption?: string): Promise<AxiosResponse> {
    const apiUrl = `https://api.telegram.org/bot${this.botToken}/sendPhoto`;

    const formData = new FormData();
    formData.append('chat_id', this.chatId);
    formData.append('photo', image);
    if (caption) {
      formData.append('caption', caption);
    }

    return await firstValueFrom(
      this.httpSvc.post(apiUrl, formData, {
        headers: formData.getHeaders(),
      }).pipe(
        map((response) => response.data),
        catchError((error) => {
          console.log(error);
          return error;
        }),
      )
    );
  }
}
