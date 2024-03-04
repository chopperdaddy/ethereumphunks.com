import { Component, Input } from '@angular/core';

import { ConversationComponent } from './conversation/conversation.component';
import { ConversationsComponent } from './conversations/conversations.component';
import { LoginComponent } from './login/login.component';

import anime from 'animejs';

@Component({
  standalone: true,
  imports: [
    LoginComponent,
    ConversationsComponent,
    ConversationComponent,
  ],
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})
export class ChatComponent {

  @Input() withUser!: string;
  @Input() standalone = false;

  activeView: 'login' | 'conversations' | 'conversation' = 'login';

  constructor() {}

  selectConversation($event: string) {
    this.withUser = $event;
    this.activeView = 'conversation';
  }

  signedIn($event: boolean) {
    // this.activeView = 'conversations';
    if (this.withUser && this.standalone) {
      this.activeView = 'conversation';
    } else {
      this.activeView = 'conversations';
    }
  }

  // setView() {
  //   anime.timeline({
  //     easing: 'cubicBezier(0.785, 0.135, 0.15, 0.86)',
  //     duration: 400,
  //   }).add({
  //     targets: this.el?.nativeElement,
  //     translateX: this.active ? '0' : '100%',
  //   });
  // }

}
