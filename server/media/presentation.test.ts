import {expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import HotelVideo from '../../client/src/components/HotelVideo';
import {PhotoFrame} from '../../client/src/components/SouthsideShell';
import MediaGallery from '../../client/src/components/MediaGallery';
it('video starts under guest control and exposes native and explicit pause/play controls',()=>{
  const html=renderToStaticMarkup(createElement(HotelVideo,{src:'/hotel-media/offline.mp4',alt:'Technical fixture'}));
  expect(html).toContain('controls=""');expect(html).toContain('playsInline=""');expect(html).toContain('preload="none"');expect(html).toContain('Play video');expect(html.toLowerCase()).not.toContain('autoplay');
});
it('missing photographs use a neutral unavailable message without a substitute image',()=>{
  const html=renderToStaticMarkup(createElement(PhotoFrame,{label:'Room photograph',detail:''}));
  expect(html).toContain('Photograph unavailable');expect(html).not.toContain('<img');expect(html).not.toContain('https://');
});
it('gallery preserves supplied order, exposes keyboard-operable viewers and does not fetch full images eagerly',()=>{
 const html=renderToStaticMarkup(createElement(MediaGallery,{items:[{url:'/approved-first.webp',alt:'First approved photograph'},{url:'/approved-second.webp',alt:'Second approved photograph'}]}));
 expect(html.indexOf('/approved-first.webp')).toBeLessThan(html.indexOf('/approved-second.webp'));
 expect(html).toContain('Open photograph 1: First approved photograph');expect(html).toContain('<dialog');
 expect(html.match(/loading="lazy"/g)).toHaveLength(2);expect(html.match(/decoding="async"/g)).toHaveLength(2);
 expect(html).not.toContain('open=""');expect(html).not.toContain('autoplay');
});
it('empty galleries render no fabricated photographs and video tiles wait for guest interaction',()=>{
 expect(renderToStaticMarkup(createElement(MediaGallery,{items:[]}))).toBe('');
 const html=renderToStaticMarkup(createElement(MediaGallery,{items:[{url:'/approved-tour.mp4',alt:'Approved hotel tour',kind:'video'}]}));
 expect(html).toContain('Open video 1: Approved hotel tour');expect(html).not.toContain('<video');expect(html).not.toContain('<img');
});
