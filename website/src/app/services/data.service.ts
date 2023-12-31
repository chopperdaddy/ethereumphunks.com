import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from 'src/environments/environment';

import { createClient } from '@supabase/supabase-js';

import { Observable, from, switchMap, map, tap } from 'rxjs';
import { hexToString } from 'viem';

const supabase = createClient(
  environment.supabaseUrl,
  environment.supabaseKey
);

@Injectable({
  providedIn: 'root'
})
export class DataService {

  constructor(
    private http: HttpClient,
  ) {}

  // async getMintCount(): Promise<number> {
  //   const { data, error } = await supabase
  //     .rpc('count_ethphunks_goerli');

  //   if (error) throw error;
  //   return data;
  // }

  async getUserEthPhunks(address: string): Promise<any> {
    if (!address) return [];

    const table = environment.chainId === 1 ? 'ethscriptions' : 'ethscriptions_goerli';
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('owner', address);
      // console.log(data, error, address)
    if (error) throw error;

    return data.map((res) => {
      const data = hexToString(res.data);
      // console.log(data)
      return { ...res, data };
    });
  }

  async getSHA256Hash(value: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(value);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
    return hashHex;
  }

  checkEthPhunkExists(data: string): Observable<any> {
    return from(this.getSHA256Hash(data)).pipe(
      switchMap((hash) => this.http.get(`${environment.ethScribeApi}/ethscriptions/exists/${hash}`)),
      tap((res) => console.log({res})),
      map((res: any) => res.ethscription),
    );
  }
}
