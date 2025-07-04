import { Component, input, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

import { LazyLoadImageModule } from 'ng-lazyload-image';

import { DataService } from '@/services/data.service';
import { ImageService } from '@/services/image.service';

import { Auction } from '@/models/db';

// Import GSAP
import { gsap } from 'gsap';
import { Draggable } from 'gsap/Draggable';
import { InertiaPlugin } from 'gsap/InertiaPlugin';

// Register the plugins
gsap.registerPlugin(Draggable, InertiaPlugin);

@Component({
  selector: 'app-auctions',
  standalone: true,
  imports: [
    CommonModule,
    LazyLoadImageModule
  ],
  templateUrl: './auctions.component.html',
  styleUrls: ['./auctions.component.scss']
})
export class AuctionsComponent implements AfterViewInit, OnDestroy {

  auctions = input<Auction[] | null | undefined>();

  @ViewChild('wrapper', { static: false }) wrapper!: ElementRef;

  private loop: any;
  private activeElement: any;

  constructor(
    public dataSvc: DataService,
    public imageSvc: ImageService
  ) {}

  ngAfterViewInit() {
    setTimeout(() => {
      this.initializeCarousel();
    }, 100);
  }

  ngOnDestroy() {
    this.loop?.kill();
  }

  private initializeCarousel() {
    const boxes = gsap.utils.toArray('.box');

    if (boxes.length === 0) return;

    this.loop = this.horizontalLoop(boxes, {
      paused: true,
      draggable: true,
      center: true,
      onChange: (element: any, index: number) => {
        this.activeElement && this.activeElement.classList.remove('active');
        element.classList.add('active');
        this.activeElement = element;
      }
    });

    boxes.forEach((box: any, i: number) => {
      box.addEventListener('click', () => {
        this.loop.toIndex(i, { duration: 0.8, ease: 'power1.inOut' });
      });
    });

    const toggleBtn = document.querySelector('.toggle') as HTMLElement;
    const nextBtn = document.querySelector('.next') as HTMLElement;
    const prevBtn = document.querySelector('.prev') as HTMLElement;

    toggleBtn?.addEventListener('click', () => {
      this.wrapper.nativeElement.classList.toggle('show-overflow');
    });

    nextBtn?.addEventListener('click', () => {
      this.loop.next({ duration: 0.4, ease: 'power1.inOut' });
    });

    prevBtn?.addEventListener('click', () => {
      this.loop.previous({ duration: 0.4, ease: 'power1.inOut' });
    });
  }

  /*
  This helper function makes a group of elements animate along the x-axis in a seamless, responsive loop.

  Features:
   - Uses xPercent so that even if the widths change (like if the window gets resized), it should still work in most cases.
   - When each item animates to the left or right enough, it will loop back to the other side
   - Optionally pass in a config object with values like draggable: true, center: true, speed (default: 1, which travels at roughly 100 pixels per second), paused (boolean), repeat, reversed, and paddingRight.
   - The returned timeline will have the following methods added to it:
     - next() - animates to the next element using a timeline.tweenTo() which it returns. You can pass in a vars object to control duration, easing, etc.
     - previous() - animates to the previous element using a timeline.tweenTo() which it returns. You can pass in a vars object to control duration, easing, etc.
     - toIndex() - pass in a zero-based index value of the element that it should animate to, and optionally pass in a vars object to control duration, easing, etc. Always goes in the shortest direction
     - current() - returns the current index (if an animation is in-progress, it reflects the final index)
     - times - an Array of the times on the timeline where each element hits the "starting" spot.
   */
  private horizontalLoop(items: any[], config: any = {}) {
    let timeline: any;
    items = gsap.utils.toArray(items);
    config = config || {};

    return gsap.context(() => {
      let onChange = config.onChange,
        lastIndex = 0,
        tl = gsap.timeline({
          repeat: config.repeat,
          onUpdate: onChange && function() {
            let i = tl.closestIndex();
            if (lastIndex !== i) {
              lastIndex = i;
              onChange(items[i], i);
            }
          },
          paused: config.paused,
          defaults: { ease: 'none' },
          onReverseComplete: () => { tl.totalTime(tl.rawTime() + tl.duration() * 100); }
        }),
        length = items.length,
        startX = items[0].offsetLeft,
        times: number[] = [],
        widths: number[] = [],
        spaceBefore: number[] = [],
        xPercents: number[] = [],
        curIndex = 0,
        indexIsDirty = false,
        center = config.center,
        pixelsPerSecond = (config.speed || 1) * 100,
        snap = config.snap === false ? (v: number) => v : gsap.utils.snap(config.snap || 1),
        timeOffset = 0,
        container = center === true ? items[0].parentNode : gsap.utils.toArray(center)[0] || items[0].parentNode,
        totalWidth: number,
        getTotalWidth = () => items[length - 1].offsetLeft + xPercents[length - 1] / 100 * widths[length - 1] - startX + spaceBefore[0] + items[length - 1].offsetWidth * Number(gsap.getProperty(items[length - 1], 'scaleX')) + (parseFloat(config.paddingRight) || 0),
        populateWidths = () => {
          let b1 = container.getBoundingClientRect(), b2: any;
          items.forEach((el: any, i: number) => {
            widths[i] = parseFloat(gsap.getProperty(el, 'width', 'px') as string);
            xPercents[i] = snap(parseFloat(gsap.getProperty(el, 'x', 'px') as string) / widths[i] * 100 + Number(gsap.getProperty(el, 'xPercent')));
            b2 = el.getBoundingClientRect();
            spaceBefore[i] = b2.left - (i ? b1.right : b1.left);
            b1 = b2;
          });
          gsap.set(items, {
            xPercent: (i: number) => xPercents[i]
          });
          totalWidth = getTotalWidth();
        },
        timeWrap: any = gsap.utils.wrap(0, 1),
        populateOffsets = () => {
          timeOffset = center ? tl.duration() * (container.offsetWidth / 2) / totalWidth : 0;
          center && times.forEach((t, i) => {
            times[i] = timeWrap(tl.labels['label' + i] + tl.duration() * widths[i] / 2 / totalWidth - timeOffset);
          });
        },
        getClosest = (values: number[], value: number, wrap: number) => {
          let i = values.length,
            closest = 1e10,
            index = 0, d: number;
          while (i--) {
            d = Math.abs(values[i] - value);
            if (d > wrap / 2) {
              d = wrap - d;
            }
            if (d < closest) {
              closest = d;
              index = i;
            }
          }
          return index;
        },
        populateTimeline = () => {
          let i: number, item: any, curX: number, distanceToStart: number, distanceToLoop: number;
          tl.clear();
          for (i = 0; i < length; i++) {
            item = items[i];
            curX = xPercents[i] / 100 * widths[i];
            distanceToStart = item.offsetLeft + curX - startX + spaceBefore[0];
            distanceToLoop = distanceToStart + widths[i] * Number(gsap.getProperty(item, 'scaleX'));
            tl.to(item, { xPercent: snap((curX - distanceToLoop) / widths[i] * 100), duration: distanceToLoop / pixelsPerSecond }, 0)
              .fromTo(item, { xPercent: snap((curX - distanceToLoop + totalWidth) / widths[i] * 100) }, { xPercent: xPercents[i], duration: (curX - distanceToLoop + totalWidth - curX) / pixelsPerSecond, immediateRender: false }, distanceToLoop / pixelsPerSecond)
              .add('label' + i, distanceToStart / pixelsPerSecond);
            times[i] = distanceToStart / pixelsPerSecond;
          }
          timeWrap = gsap.utils.wrap(0, tl.duration());
        },
        refresh = (deep?: boolean) => {
          let progress = tl.progress();
          tl.progress(0, true);
          populateWidths();
          deep && populateTimeline();
          populateOffsets();
          deep && tl.draggable && tl.paused() ? tl.time(times[curIndex], true) : tl.progress(progress, true);
        },
        onResize = () => refresh(true),
        proxy: any;

      gsap.set(items, { x: 0 });
      populateWidths();
      populateTimeline();
      populateOffsets();
      window.addEventListener('resize', onResize);

      function toIndex(index: number, vars: any = {}) {
        (Math.abs(index - curIndex) > length / 2) && (index += index > curIndex ? -length : length);
        let newIndex = gsap.utils.wrap(0, length, index),
          time = times[newIndex];
        if (time > tl.time() !== index > curIndex && index !== curIndex) {
          time += tl.duration() * (index > curIndex ? 1 : -1);
        }
        if (time < 0 || time > tl.duration()) {
          vars.modifiers = { time: timeWrap };
        }
        curIndex = newIndex;
        vars.overwrite = true;
        gsap.killTweensOf(proxy);
        return vars.duration === 0 ? tl.time(timeWrap(time)) : tl.tweenTo(time, vars);
      }

      tl.toIndex = (index: number, vars?: any) => toIndex(index, vars);
      tl.closestIndex = (setCurrent?: boolean) => {
        let index = getClosest(times, tl.time(), tl.duration());
        if (setCurrent) {
          curIndex = index;
          indexIsDirty = false;
        }
        return index;
      };
      tl.current = () => indexIsDirty ? tl.closestIndex(true) : curIndex;
      tl.next = (vars?: any) => toIndex(tl.current() + 1, vars);
      tl.previous = (vars?: any) => toIndex(tl.current() - 1, vars);
      tl.times = times;
      tl.progress(1, true).progress(0, true);

      if (config.reversed) {
        // @ts-ignore
        tl.vars.onReverseComplete();
        tl.reverse();
      }

      if (config.draggable && typeof(Draggable) === 'function') {
        proxy = document.createElement('div');
        let wrap = gsap.utils.wrap(0, 1),
          ratio: number,
          startProgress: number,
          draggable: any,
          lastSnap: number,
          initChangeX: number,
          wasPlaying: boolean,
          align = () => tl.progress(wrap(startProgress + (draggable.startX - draggable.x) * ratio)),
          syncIndex = () => tl.closestIndex(true);

        typeof(InertiaPlugin) === "undefined" && console.warn("InertiaPlugin required for momentum-based scrolling and snapping. https://greensock.com/club");

        draggable = Draggable.create(proxy, {
          trigger: items[0].parentNode,
          type: 'x',
          onPressInit() {
            let x = this.x;
            gsap.killTweensOf(tl);
            wasPlaying = !tl.paused();
            tl.pause();
            startProgress = tl.progress();
            refresh();
            ratio = 1 / totalWidth;
            initChangeX = (startProgress / -ratio) - x;
            gsap.set(proxy, { x: startProgress / -ratio });
          },
          // @ts-ignore
          onDrag: align,
          // @ts-ignore
          onThrowUpdate: align,
          overshootTolerance: 0,
          inertia: true,
          snap(value: number) {
            if (Math.abs(startProgress / -ratio - this.x) < 10) {
              return lastSnap + initChangeX;
            }
            let time = -(value * ratio) * tl.duration(),
              wrappedTime = timeWrap(time),
              snapTime = times[getClosest(times, wrappedTime, tl.duration())],
              dif = snapTime - wrappedTime;
            Math.abs(dif) > tl.duration() / 2 && (dif += dif < 0 ? tl.duration() : -tl.duration());
            lastSnap = (time + dif) / tl.duration() / -ratio;
            return lastSnap;
          },
          onRelease() {
            syncIndex();
            draggable.isThrowing && (indexIsDirty = true);
          },
          onThrowComplete: () => {
            syncIndex();
            wasPlaying && tl.play();
          }
        })[0];
        tl.draggable = draggable;
      }

      tl.closestIndex(true);
      lastIndex = curIndex;
      onChange && onChange(items[curIndex], curIndex);
      timeline = tl;
      return () => window.removeEventListener('resize', onResize);
    });
  }
}
