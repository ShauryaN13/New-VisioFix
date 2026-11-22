import type { FocusDoc } from '@/focus/model';
import type { PageReport } from '@/shared/report';
import type { OptionsModel } from '@/ui/options/view';
import type { PopupModel } from '@/ui/popup/view';

/** Sample data for the design preview. All names and text are made up. */

const SHORTCUTS = { focusMode: 'Alt+Shift+F', readAloud: 'Alt+Shift+K' };
const HOST = 'news.example.com';

const busyReport: PageReport = {
  fixes: { linkNames: 4, fieldLabels: 2, imageDescriptions: 3, decorativeImages: 2, hiddenDuplicates: 1 },
  notFixed: { unnamedControls: 3, imagesNeedDescription: 2, invalidRoles: 1, brokenReferences: 2, hiddenFocusable: 1 },
  headings: [
    { kind: 'skipped-level', from: 2, to: 4, text: 'Related stories' },
    { kind: 'empty', level: 3 },
  ],
};

const cleanReport: PageReport = {
  fixes: { linkNames: 0, fieldLabels: 0, imageDescriptions: 0, decorativeImages: 0, hiddenDuplicates: 0 },
  notFixed: { unnamedControls: 0, imagesNeedDescription: 0, invalidRoles: 0, brokenReferences: 0, hiddenFocusable: 0 },
  headings: [],
};

export const popupStates: Record<string, PopupModel> = {
  ready: { view: { kind: 'ready', host: HOST, repairsOn: true, report: busyReport }, shortcuts: SHORTCUTS },
  clean: { view: { kind: 'ready', host: 'www.example.org', repairsOn: true, report: cleanReport }, shortcuts: SHORTCUTS },
  'site-off': { view: { kind: 'ready', host: HOST, repairsOn: false, report: null }, shortcuts: SHORTCUTS },
  'off-everywhere': { view: { kind: 'off-everywhere', host: HOST }, shortcuts: SHORTCUTS },
  unsupported: { view: { kind: 'unsupported' }, shortcuts: SHORTCUTS },
  'needs-reload': { view: { kind: 'needs-reload', host: HOST }, shortcuts: SHORTCUTS },
};

/** A simple illustration as an inline SVG, so the preview needs no image files. */
const ROOM_IMAGE = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400">
    <rect width="800" height="400" fill="#6b4f3a"/>
    <rect x="0" y="300" width="800" height="100" fill="#3d2c22"/>
    ${[40, 210, 380, 550]
      .map(
        (x) => `<rect x="${x}" y="40" width="150" height="250" fill="#4a3426"/>
      ${[70, 130, 190, 250]
        .map(
          (y) =>
            `<rect x="${x + 10}" y="${y - 22}" width="130" height="22" fill="#e8c27a"/><rect x="${x + 10}" y="${y}" width="130" height="5" fill="#2b1f18"/>`,
        )
        .join('')}`,
      )
      .join('')}
    <rect x="300" y="250" width="200" height="70" rx="14" fill="#9fb8a0"/>
    <rect x="300" y="215" width="200" height="45" rx="14" fill="#b8cdb8"/>
  </svg>`,
)}`;

export const article: FocusDoc = {
  title: 'Riverside library adds evening hours and a quiet reading room',
  siteName: 'Riverside Courier',
  byline: 'By Dana Whitfield',
  lang: 'en',
  dir: 'ltr',
  isFallback: false,
  truncated: false,
  blocks: [
    {
      kind: 'paragraph',
      content: [
        'Starting next month, the ',
        { kind: 'link', href: 'https://library.example.com', children: ['Riverside Public Library'] },
        ' will stay open until 9 p.m. on weekdays. The change follows a year of requests from students, shift workers and parents who could only visit after dinner.',
      ],
    },
    {
      kind: 'paragraph',
      content: [
        'Library director Marcus Hale said the longer hours are paid for by a state grant. “People told us the building closed right when they finally had time to use it,” he said. The grant also covers two new staff members for the evening shift.',
      ],
    },
    { kind: 'heading', level: 2, content: ['A room built for reading'] },
    {
      kind: 'paragraph',
      content: [
        'The second floor now has a quiet room with adjustable lighting, ',
        { kind: 'strong', children: ['large-print books'] },
        ' and two desktop magnifiers. Staff can also set up a computer with a screen reader on request.',
      ],
    },
    {
      kind: 'figure',
      src: ROOM_IMAGE,
      alt: 'Tall wooden bookshelves and a pale green reading sofa in the new quiet room.',
      caption: ['The new quiet reading room on the second floor.'],
    },
    { kind: 'heading', level: 3, content: ['What’s available'] },
    {
      kind: 'list',
      ordered: false,
      items: [
        [{ kind: 'paragraph', content: ['Large-print and audio books'] }],
        [{ kind: 'paragraph', content: ['Two desktop video magnifiers'] }],
        [{ kind: 'paragraph', content: ['Computers with screen readers, set up on request'] }],
      ],
    },
    {
      kind: 'quote',
      blocks: [
        {
          kind: 'paragraph',
          content: [
            '“It’s the first place in town where I can read for an hour without a headache,” said longtime visitor Ana Ruiz.',
          ],
        },
      ],
    },
    { kind: 'heading', level: 2, content: ['How to visit'] },
    {
      kind: 'paragraph',
      content: [
        'The library is at 210 Water Street. Evening hours begin on the first Monday of next month. For details, see the ',
        { kind: 'link', href: 'https://library.example.com/events', children: ['library’s events page'] },
        ' or call the front desk.',
      ],
    },
  ],
};

export const fallbackDoc: FocusDoc = {
  title: 'Riverside Courier: local news',
  siteName: 'Riverside Courier',
  byline: null,
  lang: 'en',
  dir: 'ltr',
  isFallback: true,
  truncated: false,
  blocks: [
    { kind: 'heading', level: 2, content: ['Top stories'] },
    {
      kind: 'list',
      ordered: false,
      items: [
        [{ kind: 'paragraph', content: [{ kind: 'link', href: '#', children: ['Library adds evening hours and a quiet reading room'] }] }],
        [{ kind: 'paragraph', content: [{ kind: 'link', href: '#', children: ['Water Street bridge reopens after repairs'] }] }],
        [{ kind: 'paragraph', content: [{ kind: 'link', href: '#', children: ['High school robotics team heads to state finals'] }] }],
      ],
    },
    { kind: 'heading', level: 2, content: ['Weather'] },
    { kind: 'paragraph', content: ['Cloudy this morning, clearing by afternoon. High of 61°F.'] },
  ],
};

export const optionsModel: OptionsModel = {
  repairsOn: true,
  offSites: ['mail.example.com', 'video.example.org'],
  theme: 'contrast',
  textSize: 22,
  voices: [
    { id: 'david', name: 'Microsoft David - English (United States)', lang: 'en-US', local: true },
    { id: 'zira', name: 'Microsoft Zira - English (United States)', lang: 'en-US', local: true },
    { id: 'hazel', name: 'Microsoft Hazel - English (United Kingdom)', lang: 'en-GB', local: true },
    { id: 'google-us', name: 'Google US English', lang: 'en-US', local: false },
  ],
  voiceId: null,
  allowOnlineVoices: false,
  speed: 1,
  sampleNote: null,
  shortcuts: [
    { action: 'Open or close Focus Mode', shortcut: 'Alt+Shift+F' },
    { action: 'Read aloud: play or pause', shortcut: 'Alt+Shift+K' },
    { action: 'Read aloud: next sentence', shortcut: 'Alt+Shift+.' },
    { action: 'Read aloud: previous sentence', shortcut: 'Alt+Shift+,' },
  ],
};
