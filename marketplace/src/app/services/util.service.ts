import { Injectable } from '@angular/core';

import { v5 } from 'uuid';

@Injectable({
  providedIn: 'root'
})

export class UtilService {

  createIdFromString(str: string): string {
    return v5(str, v5.URL);
  }

}
