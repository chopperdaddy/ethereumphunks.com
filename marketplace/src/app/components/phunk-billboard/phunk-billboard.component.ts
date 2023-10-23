import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { LazyLoadImageModule } from 'ng-lazyload-image';

import { PhunkImageComponent } from '../phunk-image/phunk-image.component';

import { TokenIdParsePipe } from '@/pipes/token-id-parse.pipe';

import { Phunk } from '@/models/graph';

@Component({
  selector: 'app-phunk-billboard',
  standalone: true,
  imports: [
    CommonModule,
    LazyLoadImageModule,
    RouterModule,

    PhunkImageComponent,
    TokenIdParsePipe
  ],
  templateUrl: './phunk-billboard.component.html',
  styleUrls: ['./phunk-billboard.component.scss']
})

export class PhunkBillboardComponent {

  @Input() data!: Phunk | null;

}
