import { Component, EventEmitter, Output } from '@angular/core';

import { ChatService } from '@/services/chat.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {

  @Output() signedIn: EventEmitter<boolean> = new EventEmitter<boolean>(false);

  constructor(
    private chatSvc: ChatService
  ) {}

  async signIn(): Promise<void> {
    await this.chatSvc.signInToXmtp();
    this.signedIn.emit(true);
  }
}
