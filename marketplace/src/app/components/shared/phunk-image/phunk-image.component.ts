import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

import { Web3Service } from '@/services/web3.service';

import { hexToString } from 'viem';

@Component({
  selector: 'app-phunk-image',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './phunk-image.component.html',
  styleUrls: ['./phunk-image.component.scss']
})
export class PhunkImageComponent implements OnChanges {

  @Input() hashId!: string;
  @Input() tokenId!: number;
  @Input() color: boolean = true;

  phunkImgSrc!: string | null;

  constructor(
    private http: HttpClient,
    private web3Svc: Web3Service,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes.hashId &&
      changes.hashId.currentValue &&
      changes.hashId.currentValue !== changes.hashId.previousValue
    ) {
      this.getPhunkByHashId(this.hashId);
      return;
    }
  }

  async getPhunkByHashId(hashId: string): Promise<any> {
    const tx = await this.web3Svc.getTransaction(hashId);
    // console.log(tx);
    this.phunkImgSrc = hexToString(tx.input);
  }
}
