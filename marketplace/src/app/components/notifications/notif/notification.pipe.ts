import { Pipe, PipeTransform } from '@angular/core';

import { Notification, TxFunction } from '@/models/global-state';

type NotificationTexts = {
  titles: {
    [key in TxFunction]: string;
  } & { // Use intersection type to add 'batch' separately
    batch: {
      [key in TxFunction]?: string;
    };
  };
  body: {
    [key in Notification['type']]: {
      message: string;
    };
  };
  classes: {
    [key in TxFunction]: string;
  };
};

@Pipe({
  standalone: true,
  name: 'notifText'
})
export class NotificationPipe implements PipeTransform {

  notifs: NotificationTexts = {
    titles: {
      sendToEscrow: 'Send to Escrow',
      phunkNoLongerForSale: 'Delist %singleName%',
      offerPhunkForSale: 'Offer %singleName% For Sale',
      withdrawBidForPhunk: 'Withdraw Bid For %singleName%',
      acceptBidForPhunk: 'Accept Bid For %singleName%',
      buyPhunk: 'Buy %singleName%',
      enterBidForPhunk: 'Enter Bid For %singleName%',
      transferPhunk: 'Transfer %singleName%',
      withdrawPhunk: 'Withdraw %singleName% from Escrow',
      purchased: 'Your item Sold!',
      chatMessage: 'New message',
      batch: {
        sendToEscrow: 'Send <span class="highlight">%length%</span> items to Escrow',
        phunkNoLongerForSale: 'Delist <span class="highlight">%length%</span> items',
        offerPhunkForSale: 'Offer <span class="highlight">%length%</span> items For Sale',
        withdrawBidForPhunk: 'Withdraw Bid For <span class="highlight">%length%</span> items',
        acceptBidForPhunk: 'Accept Bid For <span class="highlight">%length%</span> items',
        buyPhunk: 'Buy <span class="highlight">%length%</span> items',
        enterBidForPhunk: 'Enter Bid For <span class="highlight">%length%</span> items',
        transferPhunk: 'Transfer <span class="highlight">%length%</span> items',
        withdrawPhunk: 'Withdraw <span class="highlight">%length%</span> items from Escrow',
      },
    },
    body: {
      event: {
        message: 'Sold for <strong>%value%Ξ</strong>'
      },
      wallet: {
        message: '<strong>Please submit</strong> the transaction using your connected Ethereum wallet.'
      },
      pending: {
        message: 'Your transaction is <strong>being processed</strong> on the Ethereum network.'
      },
      complete: {
        message: 'Your transaction is <strong>complete</strong>.'
      },
      error: {
        message: 'There was an <strong>error</strong> with your transaction.'
      },
      chat: {
        message: 'New message'
      },
    },
    classes: {
      sendToEscrow: 'escrow',
      phunkNoLongerForSale: 'sale',
      offerPhunkForSale: 'sale',
      withdrawBidForPhunk: 'bid',
      acceptBidForPhunk: 'bid',
      buyPhunk: 'sale',
      enterBidForPhunk: 'bid',
      transferPhunk: 'transfer',
      withdrawPhunk: 'escrow',
      purchased: 'purchased',
      chatMessage: 'chat',
    },
  }

  transform(
    notif: Notification,
    collections: any,
    type: 'title' | 'body' | 'class'
  ): string | null {

    if (!notif) return null;

    // console.log({ notif, collections, type })

    if (type === 'class') {
      return this.notifs.classes[notif.function];
    }

    if (type === 'title') {
      let title = this.notifs.titles[notif.function];

      if (notif.isBatch && notif.hashIds) {
        title = this.notifs.titles.batch[notif.function]!.replace('%length%', `${notif.hashIds.length}`);
      }

      if (notif.slug) {
        title = title.replace('%singleName%', collections[notif.slug]?.singleName || '');
      }

      if (notif.chatAddress) {
        title = this.notifs.titles.chatMessage;
      }

      return title;
    }

    if (type === 'body') {
      if (notif.type === 'event') {
        return this.notifs.body.event.message.replace('%value%', `${notif.value}`);
      }

      if (notif.isBatch && notif.hashIds) {
        return this.notifs.body[notif.type].message;
      }

      return this.notifs.body[notif.type].message.replace('%tokenId%', `${notif.tokenId}`);
    }

    return '';
  }
}
