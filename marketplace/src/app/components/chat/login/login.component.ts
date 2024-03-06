import { Component } from '@angular/core';
import { Store } from '@ngrx/store';

import { ChatService } from '@/services/chat.service';

import { GlobalState } from '@/models/global-state';
import { setChatActive } from '@/state/actions/chat.actions';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {

  constructor(
    private store: Store<GlobalState>,
    private chatSvc: ChatService
  ) {}

  async signIn(): Promise<void> {
    try {
      const signedIn = await this.chatSvc.signInToXmtp();
      this.store.dispatch(setChatActive({ active: signedIn }));
    } catch (error) {
      console.error('Error signing in to XMTP', error);
    }
  }
}
