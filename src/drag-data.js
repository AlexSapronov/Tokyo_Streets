// Each phase exposes its entire action set, with no random draw.
export const DRAG_CARDS = [
  {id:'drag-warm',name:'Ровный прогрев',en:'CONTROLLED WARMUP',icon:'≋',category:'Подготовка',phase:'prep',desc:'Шины 60°C, средние обороты. Универсальная подготовка без сильного износа.',temp:60,rpm:4300,pressure:1,focus:2,heat:2,wear:.5},
  {id:'drag-burnout',name:'Бёрнаут',en:'BURNOUT',icon:'◎',category:'Подготовка',phase:'prep',desc:'Шины 90°C и высокие обороты. Хорошо на сухом; на мокром можно перегреть.',temp:90,rpm:5700,pressure:1,focus:7,heat:10,wear:3},
  {id:'drag-pressure',name:'Пятно контакта',en:'LOW PRESSURE',icon:'◉',category:'Подготовка',phase:'prep',desc:'Шины 68°C, давление ниже на 12%. Больше тяги со старта, больше сопротивление на скорости.',temp:68,rpm:4700,pressure:.88,focus:4,heat:4,wear:1},
  {id:'drag-soft',name:'Плавный старт',en:'PROGRESSIVE LAUNCH',icon:'↗',category:'Старт',phase:'launch',desc:'Плавно подать момент. Реакция 0.24 с; меньше пробуксовки на мокром.',throttle:.88,reaction:.24,focus:5,heat:4,wear:.7},
  {id:'drag-hard',name:'Жёсткий старт',en:'HARD LAUNCH',icon:'↯',category:'Старт',phase:'launch',desc:'Максимум момента сразу. Реакция 0.17 с; FR сильнее рискует потерять сцепление.',throttle:1.18,reaction:.17,focus:12,heat:11,wear:2},
  {id:'drag-edge',name:'На грани зелёного',en:'ANTICIPATE GREEN',icon:'⚡',category:'Старт',phase:'launch',desc:'Предугадать сигнал. Характер пилота определяет реакцию; отрицательная означает фальстарт.',throttle:1.03,reaction:'edge',focus:16,heat:8,wear:1.5},
  {id:'drag-short',name:'Ранние переключения',en:'SHORT SHIFT',icon:'⇢',category:'Разгон',phase:'shifts',desc:'Переключать раньше: меньше паузы и нагрева, но мотор выходит из пика мощности.',shift:'short',focus:4,heat:3,wear:.8},
  {id:'drag-band',name:'Держать power band',en:'POWER BAND',icon:'⇄',category:'Разгон',phase:'shifts',desc:'Точные переключения в рабочем диапазоне. Навык пилота влияет на паузу.',shift:'band',focus:10,heat:8,wear:1},
  {id:'drag-redline',name:'До отсечки',en:'REDLINE SHIFTS',icon:'»',category:'Разгон',phase:'shifts',desc:'Поздние переключения. Больше оборотов и тепла, но мощность уже спадает после пика.',shift:'redline',focus:16,heat:19,wear:1.2},
  {id:'drag-push',name:'Полная тяга',en:'FINISH FLAT OUT',icon:'↠',category:'Финиш',phase:'finish',desc:'Реализовать оставшуюся мощность на последних 102 метрах. Следить за перегревом.',power:1,focus:9,heat:13,wear:1.4},
  {id:'drag-clean',name:'Чистый финиш',en:'CLEAN FINISH',icon:'◇',category:'Финиш',phase:'finish',desc:'Сохранить рабочий диапазон без лишней тепловой нагрузки.',power:.97,focus:3,heat:3,wear:.8},
  {id:'drag-lift',name:'Поберечь мотор',en:'PROTECT ENGINE',icon:'◌',category:'Финиш',phase:'finish',desc:'Снять нагрузку: меньше мощность, охлаждение и минимальный износ.',power:.84,focus:-8,heat:-16,wear:.3}
];
