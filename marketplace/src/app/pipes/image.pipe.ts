import { Phunk } from '@/models/db';
import { Pipe, PipeTransform } from '@angular/core';

import { environment } from 'src/environments/environment';

@Pipe({
  standalone: true,
  name: 'imagePipe'
})
export class ImagePipe implements PipeTransform {

  transform(phunk: Phunk): string {
    if (!phunk) return '';

    // console.log('imagePipe', phunk);

    const { slug, tokenId } = phunk;
    // return ''

    return environment.staticUrl + '/images/' + slug + '_' + tokenId + '.png'
  }
}
