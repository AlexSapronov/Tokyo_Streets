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
  {id:'drag-push',name:'Полная тяга',en:'FINISH FLAT OUT',icon:'↠',category:'Финиш',phase:'finish',desc:'Реализовать оставшуюся мощность на финишном участке. Следить за перегревом.',power:1,focus:9,heat:13,wear:1.4},
  {id:'drag-clean',name:'Чистый финиш',en:'CLEAN FINISH',icon:'◇',category:'Финиш',phase:'finish',desc:'Сохранить рабочий диапазон без лишней тепловой нагрузки.',power:.97,focus:3,heat:3,wear:.8},
  {id:'drag-lift',name:'Поберечь мотор',en:'PROTECT ENGINE',icon:'◌',category:'Финиш',phase:'finish',desc:'Снять нагрузку: меньше мощность, охлаждение и минимальный износ.',power:.84,focus:-8,heat:-16,wear:.3}
];

// Long formats add preparation tradeoffs and repeatable high-speed decisions.
export const LONG_DRAG_CARDS = [
  {id:'drag-longgear',name:'Длинная главная пара',en:'LONG FINAL DRIVE',icon:'⚙',category:'Подготовка',phase:'prep',requiresLong:true,temp:68,rpm:4700,pressure:1,gearing:.88,focus:4,heat:4,wear:1,desc:'До старта уменьшить передаточное отношение на 12%. Меньше момент и обороты, позже переключения; выше запас по отсечке.'},
  {id:'drag-pressure-high',name:'Давление под скорость',en:'HIGH SPEED PRESSURE',icon:'◎',category:'Подготовка',phase:'prep',requiresLong:true,temp:58,rpm:4300,pressure:1.12,focus:3,heat:2,wear:.6,desc:'Выше давление перед стартом: немного хуже сцепление на launch, меньше сопротивление качению на длинной прямой.'},
  {id:'drag-sustain',name:'Держать полный газ',en:'SUSTAIN FULL LOAD',icon:'↠',category:'Длинный разгон',phase:'pull',requiresLong:true,power:1,focus:12,heat:28,wear:1.3,desc:'Максимальная штатная мощность сейчас. На длинной дистанции греет мотор, а повтор приёма экспоненциально увеличивает нагрузку.'},
  {id:'drag-cooling',name:'Разгрузить мотор',en:'THERMAL RECOVERY',icon:'≋',category:'Длинный разгон',phase:'pull',requiresLong:true,power:.86,focus:-10,heat:-18,wear:.4,desc:'Прикрыть газ и охладить силовую установку, восстановить концентрацию. Потеря тяги сейчас может сохранить мощность на финише.'},
  {id:'drag-top',name:'Раньше включить высшую',en:'EARLY TOP GEAR',icon:'⇢',category:'Длинный разгон',phase:'pull',requiresLong:true,power:1,shift:'short',topGear:true,minSpeed:120,focus:6,heat:12,wear:.7,desc:'С 120 км/ч перейти на высшую передачу. Ниже обороты и нагрев, но двигатель может выпасть из рабочего диапазона.'},
  {id:'drag-bandpull',name:'Вернуть рабочий диапазон',en:'RESTORE POWER BAND',icon:'⇄',category:'Длинный разгон',phase:'pull',requiresLong:true,power:.99,shift:'band',reselectGear:true,focus:14,heat:20,wear:1,desc:'При необходимости понизить передачу и вернуться к автоматическим переключениям в power band. Смена передачи имеет цену во времени.'}
];
export const ALL_DRAG_CARDS=[...DRAG_CARDS,...LONG_DRAG_CARDS];
