import { Injectable } from '@angular/core';

import { environment } from 'src/environments/environment';

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

  async getMintCount(): Promise<number> {
    const { data, error } = await supabase
      .rpc('count_ethphunks');

    if (error) throw error;
    return data;
  }

  async getUserEthPhunks(address: string): Promise<any> {
    address = '0x000001f568875f378bf6d170b790967fe429c81a'.toLowerCase();
    if (!address) return [];

    const { data, error } = await supabase
      .from('ethPhunks')
      .select('*')
      .eq('owner', address);
    if (error) throw error;

    return data.map((res) => {
      const data = hexToString(res.data);
      // console.log(data)
      return { ...res, data };
    });
  }

  async checkEthPhunksExist(sha: string): Promise<any> {
    const { data, error } = await supabase
      .from('shas')
      .select('*')
      .eq('sha', sha);
    if (error) throw error;
    return data.length > 0;
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
}
