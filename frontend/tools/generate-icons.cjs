const { icons } = require('lucide');
const map = {
  home: 'House', users: 'Users', user: 'User', 'user-plus': 'UserPlus', 'user-circle': 'CircleUserRound',
  gamepad: 'Gamepad2', chart: ['ChartColumnIncreasing', 'ChartColumn', 'BarChart3'], 'chart-line': ['ChartLine', 'LineChart'],
  settings: 'Settings', bell: 'Bell', mail: 'Mail', lock: 'Lock', unlock: ['LockOpen', 'Unlock'], eye: 'Eye', 'eye-off': 'EyeOff',
  'arrow-left': 'ArrowLeft', 'arrow-right': 'ArrowRight', 'arrow-up-down': 'ArrowUpDown',
  'chevron-right': 'ChevronRight', 'chevron-left': 'ChevronLeft', 'chevron-down': 'ChevronDown', 'chevron-up': 'ChevronUp',
  copy: 'Copy', check: 'Check', 'check-circle': ['CircleCheck', 'CheckCircle'], x: 'X', 'x-circle': ['CircleX', 'XCircle'],
  pencil: 'Pencil', trash: 'Trash2', plus: 'Plus', 'plus-circle': ['CirclePlus', 'PlusCircle'], minus: 'Minus',
  clock: 'Clock', help: ['CircleHelp', 'HelpCircle'], 'log-out': 'LogOut', 'log-in': 'LogIn', key: 'KeyRound', link: 'Link',
  refresh: 'RefreshCw', rotate: 'RotateCcw', trophy: 'Trophy', star: 'Star', calendar: 'Calendar', filter: ['Funnel', 'Filter'],
  search: 'Search', info: 'Info', alert: ['TriangleAlert', 'AlertTriangle'], play: 'Play', volume: 'Volume2', sparkles: 'Sparkles',
  list: 'List', grid: 'LayoutGrid', hourglass: 'Hourglass', heart: 'Heart', shield: 'ShieldCheck', 'wifi-off': 'WifiOff',
  server: 'Server', flask: 'FlaskConical', menu: 'Menu', graduation: 'GraduationCap', puzzle: 'Puzzle', calculator: 'Calculator',
  book: 'BookOpen', blocks: 'Blocks', shuffle: 'Shuffle', target: 'Target', timer: 'Timer', medal: 'Medal', party: 'PartyPopper',
  smile: 'Smile', lightbulb: 'Lightbulb', send: 'Send', backspace: 'Delete', undo: 'Undo2', grip: 'GripVertical', history: 'History',
  award: 'Award', loader: ['LoaderCircle', 'Loader2'], headphones: 'Headphones', 'pen-line': 'PenLine', 'file-text': 'FileText',
  ellipsis: ['Ellipsis', 'MoreHorizontal'], 'external-link': 'ExternalLink', 'circle-dot': 'CircleDot', 'circle-slash': 'CircleSlash',
  'shield-alert': 'ShieldAlert', 'cloud-off': 'CloudOff', 'list-ordered': 'ListOrdered', 'wand': ['WandSparkles', 'Wand2'],
  'mouse-pointer': ['MousePointerClick'], 'hand': 'Hand', 'smartphone': 'Smartphone', 'door': 'DoorOpen', 'baby': 'Baby',
};
let out = `// Generated from the ISC-licensed "lucide" icon set (https://lucide.dev, v0.577.0).\n// Regenerate with frontend/tools/generate-icons.cjs when adding icons.\n\nexport type IconNode = readonly (readonly [string, Readonly<Record<string, string | number>>])[];\n\nexport const ICONS = {\n`;
const missing = [];
for (const [key, names] of Object.entries(map)) {
  const list = Array.isArray(names) ? names : [names];
  const found = list.map((n) => icons[n]).find(Boolean);
  if (!found) { missing.push(key); continue; }
  const nodes = found.map(([tag, attrs]) => { const a = { ...attrs }; delete a.key; return [tag, a]; });
  out += `  '${key}': ${JSON.stringify(nodes)},\n`;
}
out += `} as const satisfies Record<string, IconNode>;\n\nexport type IconName = keyof typeof ICONS;\n`;
require('fs').writeFileSync(process.argv[2], out);
console.log('missing:', missing.join(', ') || 'none', '| count', Object.keys(map).length - missing.length);
