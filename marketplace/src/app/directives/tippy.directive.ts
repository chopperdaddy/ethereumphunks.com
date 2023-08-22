import { Directive, Input, OnInit, ElementRef, SimpleChanges, ChangeDetectorRef, OnChanges } from '@angular/core';

import tippy, { Placement, roundArrow, followCursor, Instance, Props } from 'tippy.js';

@Directive({
  standalone: true,
  selector: '[tippy]'
})

export class TippyDirective implements OnInit, OnChanges {

  @Input('tippyOptions') public tippyOptions!: Object;

  private instance!: Instance<Props>;

  constructor(
    private el: ElementRef,
    private ref: ChangeDetectorRef
  ) {}

  public ngOnInit() {

    const el = this.el.nativeElement as HTMLElement;

    if (this.el.nativeElement._tippy) {
      const tippy = this.el.nativeElement._tippy as Instance;
      tippy.destroy();
    }

    const position = el.dataset.tippyPosition as Placement;
    const hide = el.dataset.tippyKeep;
    const appendTo = el.dataset.appendTo as Element | "parent" | ((ref: Element) => Element);

    this.instance = tippy(el, {
      content: el.dataset.tippyContent,
      followCursor: el.dataset.tippyFollow as any,
      plugins: [followCursor],
      zIndex: 21474841,
      theme: 'tipelectric',
      hideOnClick: hide ? false : true,
      arrow: roundArrow,
      allowHTML: true
    });

    if (position) this.instance.props.placement = position;
    if (appendTo) this.instance.props.appendTo = appendTo;
  }

  public ngOnDestroy() {
    this.instance?.destroy();
  }

  ngOnChanges(changes: SimpleChanges) {
    // console.log(changes);
    // this.updateProps(props);
  }

}
