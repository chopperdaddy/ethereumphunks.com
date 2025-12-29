import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

import { createCanvas, Image, registerFont } from 'canvas';

import { Collection, Ethscription } from '@/modules/storage/models/db';
import { catchError, firstValueFrom, of } from 'rxjs';
import { readFile } from 'fs/promises';
import path from 'path';

import { rarityData } from '@/modules/notifs/constants/rarity';

/**
 * Service for generating notification images
 */
@Injectable()
export class ImageService implements OnModuleInit {

  constructor(
    private readonly http: HttpService
  ) {}

  onModuleInit() {
    registerFont(path.join(__dirname, '../../../_static/retro-computer.ttf'), { family: 'RetroComputer' });
  }

  async generateSocialShareImage(data: {
    ethscription: Ethscription,
    collection: Collection,
    attributes: {
      k: string,
      v: string,
      rarity: number,
    }[],
  }): Promise<Buffer> {
    const canvasWidth = 1200;
    const canvasHeight = 630;

    const colors = {
      base: '#C3FF00',
      pink: '#FF03B4',
      blue: '#00FFC9',
    };

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = colors.base;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const bottomBarHeight = 200;
    const bottomBarPos = canvasHeight - bottomBarHeight;

    const topBarHeight = 20;
    ctx.fillStyle = colors.pink;
    ctx.fillRect(0, 0, canvasWidth, topBarHeight);

    ctx.fillStyle = colors.pink;
    ctx.fillRect(0, bottomBarPos, canvasWidth, bottomBarHeight);

    ctx.fillStyle = colors.base;
    ctx.font = '400 36px RetroComputer';
    ctx.fillText(data.collection.singleName, 34, bottomBarPos + 65);

    ctx.fillStyle = colors.base;
    ctx.font = '400 100px RetroComputer';
    ctx.fillText(`${data.ethscription.tokenId}`, 30, canvasHeight - 40);

    ctx.fillStyle = colors.blue;
    ctx.font = '400 33px RetroComputer';
    const rarityNumberWidth = ctx.measureText(`${data.attributes[0].rarity}`).width;
    ctx.fillText(`${data.attributes[0].rarity}`, (canvasWidth - rarityNumberWidth) - 60, bottomBarPos + 65);

    ctx.fillStyle = colors.base;
    ctx.font = '400 33px RetroComputer';
    const text = `One of`;
    const textWidth = ctx.measureText(text).width;
    ctx.fillText(text, (canvasWidth - textWidth) - 60 - (rarityNumberWidth + 15), bottomBarPos + 65);

    ctx.fillStyle = colors.blue;
    ctx.font = '400 33px RetroComputer';
    const text2 = `${data.attributes[0].v}`;
    const text2Width = ctx.measureText(text2).width;
    ctx.fillText(text2, (canvasWidth - text2Width) - 60, bottomBarPos + 110);

    ctx.fillStyle = colors.base;
    ctx.font = '400 33px RetroComputer';
    const text3 = `${data.collection.singleName}s`;
    const text3Width = ctx.measureText(text3).width;
    ctx.fillText(text3, (canvasWidth - text3Width) - 60, bottomBarPos + 155);

    const baseImageUrl = `https://kcbuycbhynlmsrvoegzp.supabase.co/storage/v1/object/public/images`;
    let image: ArrayBuffer | null = null;
    try {
      const response = await fetch(`${baseImageUrl}/${data.ethscription.sha}.png`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      image = await response.arrayBuffer();
    } catch (err) {
      Logger.error('Failed to load inscription image:', err);
      image = null;
    }

    if (image) {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          const imageSize = 400;
          const x = canvasWidth / 2 - imageSize / 2;
          const y = bottomBarPos - imageSize;
          ctx.drawImage(img, x, y, imageSize, imageSize);
          resolve();
        };
        img.onerror = reject;
        img.src = Buffer.from(image);
      });
    }

    try {
      const logo = new Image();
      const logoSrc = path.join(__dirname, '../../../_static/eplogo.png');
      await new Promise<void>(async (resolve, reject) => {
        logo.onload = () => {
          ctx.drawImage(
            logo,
            35,
            topBarHeight + 35,
            480 / 1.5,
            98 / 1.5
          );
          resolve();
        };
        logo.onerror = reject;
        logo.src = Buffer.from(await readFile(logoSrc));
      }).catch(() => {
        Logger.error('Failed to load logo');
      });
    } catch (err) {
      Logger.error('Failed to load logo:', err);
    }

    const buffer = canvas.toBuffer('image/png');
    return buffer;
  }

  async generateCollectionSocialImage(
    collection: Collection,
    previewItems: Ethscription[] = []
  ): Promise<Buffer> {
    const canvasWidth = 1200;
    const canvasHeight = 630;

    console.log(collection);

    const colors = {
      base: '#C3FF00',
      pink: '#FF03B4',
      blue: '#00FFC9',
    };

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = colors.base;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const bottomBarHeight = 140;
    const bottomBarPos = canvasHeight - bottomBarHeight;

    const topBarHeight = 20;
    ctx.fillStyle = colors.pink;
    ctx.fillRect(0, 0, canvasWidth, topBarHeight);

    ctx.fillStyle = colors.pink;
    ctx.fillRect(0, bottomBarPos, canvasWidth, bottomBarHeight);

    const logoSize = 80;
    const logoY = bottomBarPos + (bottomBarHeight - logoSize) / 2;
    const logoX = 34;

    if (collection.image) {
      const logoBackgroundColor = `#${collection.defaultBackground ?? 'C3FF00'}`;
      ctx.fillStyle = logoBackgroundColor;
      ctx.fillRect(logoX, logoY, logoSize, logoSize);

      try {
        const collectionImage = new Image();
        await new Promise<void>((resolve, reject) => {
          collectionImage.onload = () => {
            ctx.drawImage(collectionImage, logoX, logoY, logoSize, logoSize);
            resolve();
          };
          collectionImage.onerror = () => {
            Logger.error('Failed to load collection image');
            resolve();
          };
          if (collection.image.startsWith('data:')) {
            const base64Data = collection.image.split(',')[1];
            collectionImage.src = Buffer.from(base64Data, 'base64');
          } else {
            collectionImage.src = collection.image;
          }
        });
      } catch (err) {
        Logger.error('Failed to load collection image:', err);
      }
    }

    ctx.fillStyle = colors.base;
    ctx.font = '400 36px RetroComputer';
    const collectionNameX = collection.image ? logoX + logoSize + 15 : logoX;
    ctx.fillText(collection.name, collectionNameX, bottomBarPos + 65);

    ctx.fillStyle = colors.base;
    ctx.font = '400 28px RetroComputer';
    const urlText = `etherphunks.eth.limo/${collection.slug}`;
    ctx.fillText(urlText, collectionNameX, bottomBarPos + 105);

    const baseImageUrl = `https://kcbuycbhynlmsrvoegzp.supabase.co/storage/v1/object/public/static/images`;

    if (previewItems.length > 0) {
      const gridSize = Math.min(4, previewItems.length);
      const itemSize = 340;
      const spacing = 0;
      const totalWidth = (itemSize * gridSize) + (spacing * (gridSize - 1));
      const startX = canvasWidth / 2 - totalWidth / 2;
      const startY = bottomBarPos - itemSize;

      for (let i = 0; i < gridSize; i++) {
        const item = previewItems[i];
        const x = startX + (i * (itemSize + spacing));

        try {
          const response = await fetch(`${baseImageUrl}/${item.sha}${collection.hasTransparents ? '_transparent' : ''}`);
          if (response.ok) {
            const imageBuffer = await response.arrayBuffer();
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
              img.onload = () => {
                ctx.drawImage(img, x, startY, itemSize, itemSize);
                resolve();
              };
              img.onerror = reject;
              img.src = Buffer.from(imageBuffer);
            }).catch(() => {
              ctx.fillStyle = 'rgba(0,0,0,0.2)';
              ctx.fillRect(x, startY, itemSize, itemSize);
            });
          }
        } catch (err) {
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.fillRect(x, startY, itemSize, itemSize);
        }
      }
    }

    try {
      const logo = new Image();
      const logoSrc = path.join(__dirname, '../../../_static/eplogo.png');
      await new Promise<void>(async (resolve, reject) => {
        logo.onload = () => {
          ctx.drawImage(
            logo,
            35,
            topBarHeight + 35,
            480 / 1.5,
            98 / 1.5
          );
          resolve();
        };
        logo.onerror = reject;
        logo.src = Buffer.from(await readFile(logoSrc));
      }).catch(() => {
        Logger.error('Failed to load logo');
      });
    } catch (err) {
      Logger.error('Failed to load logo:', err);
    }

    const buffer = canvas.toBuffer('image/png');
    return buffer;
  }
}
