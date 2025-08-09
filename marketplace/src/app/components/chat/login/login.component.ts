import { Component, ViewChild, ViewChildren, QueryList, ElementRef, AfterViewInit, signal } from '@angular/core';
import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { Store } from '@ngrx/store';

import { ChatService } from '@/services/chat.service';
import { Web3Service } from '@/services/web3.service';
import { GlobalState } from '@/models/global-state';

import { selectHasAccount } from '@/state/chat/chat.selectors';
import { setChatConnected } from '@/state/chat/chat.actions';
import { selectWalletAddress } from '@/state/app/app-state.selectors';
import { map, tap } from 'rxjs/operators';

@Component({
  standalone: true,
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    NgTemplateOutlet
  ],
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {

  usePasscode = false;

  @ViewChild('signInButton') signInButton!: ElementRef<HTMLButtonElement>;
  @ViewChild('createAccountButton') createAccountButton!: ElementRef<HTMLButtonElement>;

  @ViewChildren('passcodeInput') passcodeInputs!: QueryList<ElementRef<HTMLInputElement>>;
  @ViewChildren('confirmInput') confirmInputs!: QueryList<ElementRef<HTMLInputElement>>;

  passcodeForm: FormGroup;
  passcodeConfirmForm: FormGroup;

  confirmingPasscode = signal(false);
  loading = signal(false);

  passcodeError = signal<string | null>(null);

  hasAccount$ = this.store.select(selectHasAccount);
  walletConnected$ = this.store.select(selectWalletAddress).pipe(
    map((address) => !!address),
    tap((connected) => {
      if (connected && this.usePasscode) {
        setTimeout(() => {
          this.passcodeInputs.first?.nativeElement?.focus();
        }, 100);
      }
    })
  );

  constructor(
    private store: Store<GlobalState>,
    private fb: FormBuilder,
    private chatSvc: ChatService,
    public web3Svc: Web3Service,
  ) {
    this.passcodeForm = this.fb.group({
      d0: new FormControl('', [Validators.pattern('^[0-9]$')]),
      d1: new FormControl('', [Validators.pattern('^[0-9]$')]),
      d2: new FormControl('', [Validators.pattern('^[0-9]$')]),
      d3: new FormControl('', [Validators.pattern('^[0-9]$')])
    });

    this.passcodeConfirmForm = this.fb.group({
      c0: new FormControl('', [Validators.pattern('^[0-9]$')]),
      c1: new FormControl('', [Validators.pattern('^[0-9]$')]),
      c2: new FormControl('', [Validators.pattern('^[0-9]$')]),
      c3: new FormControl('', [Validators.pattern('^[0-9]$')])
    });
  }

  /**
   * Handles input events for passcode digits
   * Manages single digit input and automatic focus advancement
   * @param event The input event
   * @param index The index of the current input field
   * @param type Whether this is for passcode or confirmation
   */
  async onInput(event: Event, index: number, type: 'passcode' | 'confirm'): Promise<void> {
    const input = event.target as HTMLInputElement;
    const isConfirmationInput = type === 'confirm';
    const controlPrefix = isConfirmationInput ? 'c' : 'd';
    const refs = isConfirmationInput ? this.confirmInputs.toArray() : this.passcodeInputs.toArray();

    // Make sure only one digit is entered
    if (input.value.length > 1) {
      input.value = input.value.slice(0, 1);
      this.passcodeForm.get(`${controlPrefix}${index}`)?.setValue(input.value);
    }

    // Move to next input if not the last input
    if (input.value.length === 1) {
      if (index < (refs.length - 1)) {
        refs[index + 1].nativeElement.focus();
        refs[index + 1].nativeElement.select();
      }
    }
  }

  /**
   * Handles focus events on input fields
   * Selects the content of the input when focused if it has a value
   * @param event The focus event
   */
  onFocus(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    if (input.value) input.select();
  }

  /**
   * Initiates the passcode verification process
   * Sets the confirmingPasscode signal to true
   */
  async verifyPasscode() {
    this.confirmingPasscode.set(true);
    setTimeout(() => {
      this.confirmInputs.first?.nativeElement?.focus();
    }, 100);
  }

  /**
   * Handles the account creation process
   * Validates matching passcodes and creates a new XMTP user
   */
  async createAccount(): Promise<void> {
    this.passcodeError.set(null);
    this.loading.set(true);

    let passcode = '';

    if (this.usePasscode) {
      const passcodeValues = this.passcodeForm.value;
      passcode = `${passcodeValues.d0}${passcodeValues.d1}${passcodeValues.d2}${passcodeValues.d3}`;

      const confirmationValues = this.passcodeConfirmForm.value;
      const confirmation = `${confirmationValues.c0}${confirmationValues.c1}${confirmationValues.c2}${confirmationValues.c3}`;

      console.log({ passcode, confirmation });

      if (passcode !== confirmation) {
        this.passcodeError.set('Passcodes do not match.');
        this.loading.set(false);
        return;
      }
    }

    try {
      const walletClient = await this.web3Svc.getActiveWalletClient();
      const address = walletClient.account.address?.toLowerCase() as `0x${string}`;
      if (!address) {
        this.passcodeError.set('No wallet address found');
        this.loading.set(false);
        return;
      }

      const { connected, activeInboxId } = await this.chatSvc.createXmtpUser(passcode, address);
      console.log('Successfully created XMTP user', { connected, activeInboxId });
      this.store.dispatch(setChatConnected({ connected, activeInboxId }));
    } catch (error) {
      console.error('Error signing in to XMTP', error);
      this.passcodeError.set('Error signing in to XMTP');
    }

    this.confirmingPasscode.set(false);
    this.loading.set(false);
  }

  /**
   * Handles the sign in process for existing users
   * Attempts to connect to XMTP with the provided passcode
   */
  async signIn(): Promise<void> {
    this.passcodeError.set(null);
    this.loading.set(true);

    let passcode = '';

    if (this.usePasscode) {
      const passcodeValues = this.passcodeForm.value;
      passcode = `${passcodeValues.d0}${passcodeValues.d1}${passcodeValues.d2}${passcodeValues.d3}`;
      console.log({ passcode });
    }

    try {
      const walletClient = await this.web3Svc.getActiveWalletClient();
      const address = walletClient.account.address?.toLowerCase() as `0x${string}`;
      if (!address) {
        this.passcodeError.set('No wallet address found');
        this.loading.set(false);
        return;
      }

      const { connected, activeInboxId } = await this.chatSvc.connectExistingXmtpUser(passcode, address);
      console.log('Successfully connected to XMTP', { connected, activeInboxId });
      this.store.dispatch(setChatConnected({ connected, activeInboxId }));
    } catch (error) {
      console.error('Error signing in to XMTP', error);
      this.passcodeError.set('Error signing in to XMTP');
    }

    this.loading.set(false);
  }

  /**
   * Resets the component state to start over
   * Clears errors, forms, and resets the confirmation state
   */
  async startOver(): Promise<void> {
    this.passcodeError.set(null);
    this.confirmingPasscode.set(false);
    this.passcodeForm.reset();
    this.passcodeConfirmForm.reset();
  }

  async createInbox() {
    try {
      const walletClient = await this.web3Svc.getActiveWalletClient();
      const address = walletClient.account.address?.toLowerCase() as `0x${string}`;
      if (!address) {
        this.passcodeError.set('No wallet address found');
        this.loading.set(false);
        return;
      }

      const { connected, activeInboxId } = await this.chatSvc.createXmtpUser('', address);
      console.log('Successfully created XMTP user', { connected, activeInboxId });
      this.store.dispatch(setChatConnected({ connected, activeInboxId }));
    } catch (error) {
      console.error('Error signing in to XMTP', error);
      this.passcodeError.set('Error signing in to XMTP');
    }
  }
}
