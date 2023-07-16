import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from 'src/environments/environment';

import { Observable, from, switchMap, map, tap } from 'rxjs';

import { createClient } from '@supabase/supabase-js';
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

  async getMintCount(): Promise<number> {
    const { data, error } = await supabase
      .rpc('count_ethphunks');

    if (error) throw error;
    return data;
  }

  async getUserEthPhunks(address: string): Promise<any> {
    // address = '0x001b4d9dd4d95b021a50c99d09de97c87a1a09c0'.toLowerCase();
    if (!address) return [];

    const table = environment.chainId === 1 ? 'ethPhunks' : 'ethPhunks_goerli';
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('owner', address);
      console.log(data, error, address)
    if (error) throw error;

    return data.map((res) => {
      const data = hexToString(res.data);
      console.log(data)
      return { ...res, data };
    });
  }

  checkEthPhunkExists(data: string): Observable<any> {
    return from(this.getSHA256Hash(data)).pipe(
      switchMap((hash) => this.http.get(`${environment.ethScribeApi}/ethscriptions/exists/${hash}`)),
      tap((res) => console.log({res})),
      map((res: any) => res.ethscription),
    );
  }

  async getSHA256Hash(value: string): Promise<string> {
    const msgUint8 = new TextEncoder().encode(value);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
    return hashHex;
  }

  // const url = `${environment.ethScribeApi}ethscriptions/owned_by/${address}`;
  // return this.http.get<any[]>(url).pipe(
  //   map((res) => {
  //     console.log(res)
  //     return res.filter((res) => (
  //       res.mimetype === 'image/svg+xml' &&
  //       res.content_uri.startsWith('data:image/svg+xml,%3Csvg%20')
  //     ));
  //   })
  // );

  // async filterEthPhunks(ethPhunks: any[]): Promise<any[]> {
  //   const filtered = [];
  //   for (const eths of ethPhunks) {
  //     const sha = await this.sha256(eths.content_uri);
  //     const exists = await this.checkEthPhunksExist(sha);
  //     if (exists) filtered.push(eths);
  //   }
  //   return filtered;
  // }

  // async sha256(input: string): Promise<string> {
  //   const encoder = new TextEncoder();
  //   const data = encoder.encode(input);
  //   const hash = await window.crypto.subtle.digest('SHA-256', data);
  //   return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  // }

  // async checkEthPhunksExist(sha: string): Promise<any> {
  //   const { data, error } = await supabase
  //     .from('shas')
  //     .select('*')
  //     .eq('sha', sha);
  //   if (error) throw error;
  //   return data.length > 0;
  // }
}
