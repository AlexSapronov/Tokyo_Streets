import {authoredRoad} from './road-sections.js';
import {segmentRoad} from './road-segments.js';
export const CARS = [
 {id:'ae86',brand:'TOYOTA',name:'Sprinter Trueno AE86',year:1986,tag:'Лёгкий FR',drive:'FR',power:130,mass:940,grip:1.02,brakes:1.0,cooling:1.0,color:'#eee8d9',price:18000,engine:'4A-GE · 1.6 L · NA',description:'Лёгкий кузов и точная смена направления. Прощает меньше ошибок на мокром выходе, зато бережёт тормоза.'},
 {id:'chaser',brand:'TOYOTA',name:'Chaser Tourer V JZX100',year:1996,tag:'Мощный FR',drive:'FR',power:280,mass:1470,grip:1.0,brakes:.96,cooling:.9,color:'#944fff',price:45000,engine:'1JZ-GTE · 2.5 L · TURBO',description:'Тяга турбошестёрки решает на прямых. Масса нагружает тормоза, а мокрые шпильки требуют терпения.'},
 {id:'evo',brand:'MITSUBISHI',name:'Lancer Evolution VI',year:1999,tag:'Устойчивый AWD',drive:'AWD',power:280,mass:1360,grip:1.09,brakes:1.06,cooling:1.05,color:'#e34b43',price:60000,engine:'4G63T · 2.0 L · TURBO',description:'Полный привод раньше реализует тягу на мокром асфальте. Тяжелее AE86 и быстрее расходует передние шины.'},
 {id:'mx5',brand:'MAZDA',name:'Eunos Roadster NA6CE',year:1989,tag:'Лёгкий родстер',drive:'FR',power:120,mass:940,grip:1.04,brakes:1.0,cooling:1.04,color:'#3a9e6f',price:24000,engine:'B6-ZE · 1.6 L · NA',description:'Дешёвый лёгкий родстер: точные связки и умеренный расход шин. На длинной прямой не хватает мощности.'},
 {id:'s13',brand:'NISSAN',name:"Silvia K’s S13",year:1991,tag:'Сбалансированный турбо FR',drive:'FR',power:205,mass:1170,grip:1.03,brakes:1.0,cooling:.98,color:'#83b8b0',price:38000,engine:'SR20DET · 2.0 L · TURBO',description:'Промежуточная ступень между AE86 и мощными купе. Подходит для дрифта и наращивания турбонаддува.'},
 {id:'rx7',brand:'MAZDA',name:'RX-7 Type RS FD3S',year:1999,tag:'Роторное купе',drive:'FR',power:280,mass:1280,grip:1.08,brakes:1.05,cooling:.82,color:'#f2c64f',price:78000,engine:'13B-REW · 1.3 L · TWIN TURBO',description:'Быстрое лёгкое купе для дуг и дрифта. Роторный мотор требует особенно внимательного охлаждения.'},
 {id:'r32',brand:'NISSAN',name:'Skyline GT-R BNR32',year:1991,tag:'Тяжёлый AWD',drive:'AWD',power:280,mass:1430,grip:1.08,brakes:1.04,cooling:.98,color:'#74829a',price:82000,engine:'RB26DETT · 2.6 L · TWIN TURBO',description:'Уверенный старт и тяга в дождь. Масса и сложный полный привод увеличивают расход ресурса.'},
 {id:'supra',brand:'TOYOTA',name:'Supra RZ JZA80',year:1993,tag:'Турбо GT',drive:'FR',power:280,mass:1510,grip:1.02,brakes:1.03,cooling:1.03,color:'#d5dbe0',price:85000,engine:'2JZ-GTE · 3.0 L · TWIN TURBO',description:'Тяжёлое мощное GT с шестиступенчатой коробкой. Хорошая основа для дрэга, сложнее в тесных связках.'},
 {id:'ek9',brand:'HONDA',name:'Civic Type R EK9',year:1997,tag:'Высокооборотный FF',drive:'FF',power:185,mass:1070,grip:1.07,brakes:1.03,cooling:1.08,color:'#f0f0db',price:40000,engine:'B16B · 1.6 L · NA',description:'Лёгкий переднеприводный хэтчбек для Time Attack. Передние колёса совмещают поворот и тягу; устойчивый силовой дрифт даётся плохо.'},
 {id:'nsx',brand:'HONDA',name:'NSX NA1',year:1990,tag:'Среднемоторный MR',drive:'MR',power:280,mass:1350,grip:1.12,brakes:1.08,cooling:1.0,color:'#eb6547',price:110000,engine:'C30A · 3.0 L · NA',description:'Точная среднемоторная машина с сильным сцеплением. Быстрый отклик полезен в связках, но требует аккуратности на пределе.'},
 {id:'r34',brand:'NISSAN',name:'Skyline GT-R BNR34',year:1999,tag:'Точный AWD',drive:'AWD',power:280,mass:1540,grip:1.11,brakes:1.08,cooling:1.02,color:'#346cbb',price:98000,engine:'RB26DETT · 2.6 L · TWIN TURBO',description:'Поздняя эволюция GT-R: точнее заходит в быстрые повороты и стабильнее тормозит, чем R32, но дополнительные килограммы требуют контроля шин и температуры.'}
];
export const PILOTS = [
 {id:'ren',name:'Рэн Такахаси',title:'Точность прежде всего',trait:'Дисциплина',skill:.94,aggression:.9,focus:100,card:'apex',color:'#8dc9bd',description:'Меньше нагрузка на концентрацию. Умеет держать идеальную траекторию.'},
 {id:'aki',name:'Аки Мори',title:'Тормозить последним',trait:'Агрессия',skill:.88,aggression:1.18,focus:90,card:'dive',color:'#fa8657',description:'Сильнее атакует, но перегружает шины. Открывает решающий выпад при близком сопернике.'},
 {id:'yui',name:'Юи Накамура',title:'Чувствовать сцепление',trait:'Хладнокровие',skill:.98,aggression:.8,focus:110,card:'rain',color:'#b8a1e3',description:'Точно читает мокрый асфальт. Владеет дождевой траекторией.'}
];
export const PARTS = [
 {id:'tires',slot:'tires',name:'Yokohama ADVAN A052',type:'Полуслик',price:14000,desc:'Сухое сцепление +12%; на мокром −7%; износ ×1.25.',effect:'grip'},
 {id:'brakes',name:'Brembo GT',type:'Тормозной комплект',price:18000,desc:'Эффективность торможения +18%, нагрев ×0.7. Меняет позднее торможение.',effect:'brakes'},
 {id:'cooling',name:'HKS Oil Cooler',type:'Охлаждение',price:9000,desc:'Теплоотвод +30%. Открывает карту «Тепловое окно».',effect:'cooling'},
 {id:'lsd',name:'CUSCO Type RS',type:'Дифференциал LSD',price:12000,desc:'Выход из поворота +5% тяги. Снижает риск силового выхода у FR.',effect:'traction'},
 {id:'suspension',name:'TEIN Flex Z',type:'Подвеска',price:15000,desc:'Сцепление +5%, масса +8 кг. Усиливает перенос веса.',effect:'balance'},
 {id:'weight',name:'RECARO / облегчение',type:'Салон и масса',price:11000,desc:'Масса −65 кг. Концентрация расходуется на 10% быстрее.',effect:'mass'},
 {id:'wetTires',slot:'tires',name:'Yokohama ADVAN A050 Wet',type:'Дождевые шины',price:11000,desc:'Мокрое сцепление +14%, сухое −5%, износ ×1.1. Заменяют полуслик или слик.',effect:'wet'},
 {id:'slicks',slot:'tires',name:'Yokohama ADVAN A005',type:'Слик',price:20000,desc:'Сухое сцепление +18%, мокрое −30%, износ ×1.55. Вместо других шин.',effect:'slick'},
 {id:'ecu',name:'HKS F-CON V Pro',type:'ЭБУ',price:16000,desc:'Мощность +8%; тепловая нагрузка +12%. Игровая настройка под конкретный мотор.',effect:'power'},
 {id:'turbo',turboOnly:true,name:'HKS GT III',type:'Турбокомплект',price:32000,desc:'Для турбомоторов: мощность +22%, масса +18 кг, нагрев ×1.35, износ ×1.15, расход фокуса +8%.',effect:'boost'},
 {id:'cams',naOnly:true,name:'TODA Racing Camshafts',type:'Распредвалы',price:22000,desc:'Для атмосферных моторов: пиковая мощность +12%, нагрев +15%; меньше тяги на низких оборотах.',effect:'cams'},
 {id:'shortFinal',slot:'final',name:'CUSCO Close Final Drive',type:'Короткая главная пара',price:13000,desc:'Передаточное отношение +12%: раньше переключения и выше обороты, меньше запас по отсечке. Заменяет длинную пару.',effect:'gearing'},
 {id:'longFinal',slot:'final',name:'CUSCO High Speed Final Drive',type:'Длинная главная пара',price:13000,desc:'Передаточное отношение −12%: ниже обороты, хуже тяга на низкой скорости. Заменяет короткую пару.',effect:'gearing'},
 {id:'aero',name:'Voltex GT Wing',type:'Аэродинамика',price:17000,desc:'Сцепление растёт со скоростью до +10%; сопротивление воздуху +14%, масса +12 кг. На медленной дуге почти не помогает.',effect:'aero'},
 {id:'clutch',name:'EXEDY Hyper Single',type:'Сцепление',price:14000,desc:'Паузы переключений в дрэге −28%. Нагрев +8%, износ +6%: более резкая передача момента.',effect:'shift'},
 {id:'gearbox',slot:'final',name:'HKS Dog Mission',type:'Регулируемая коробка',price:24000,desc:'Открывает настройку главной пары от ×0.85 до ×1.15. Вместо фиксированной короткой/длинной пары. На стоковой коробке регулировка закрыта.',effect:'adjustable'},
 {id:'angle',rearOnly:true,name:'Wisefab Angle Kit',type:'Дрифтовая геометрия',price:10000,desc:'Для FR/MR: точность дрифта +0.045, отклик угла +8%, масса +4 кг. Требует контроля целевого угла.',effect:'drift'}
];
// Values below are gameplay approximations, not manufacturer specifications.
PARTS.push(
 {id:'streetTires',slot:'tires',name:'Michelin Pilot Sport 4S',type:'Дорожные шины',price:9000,desc:'Сухое сцепление +5%, мокрое +6%, износ ×0.85. Универсальный комплект вместо полуслика/слика.',effect:'street'},
 {id:'dragRadial',slot:'tires',name:'Nitto NT555RII',type:'Дрэг-радиал',price:17000,desc:'Сухое сцепление в дрэге +20%, в других дисциплинах +3%. Мокрое −28%, износ ×1.1, сопротивление качению +4%.',effect:'launch'},
 {id:'exhaust',name:'FUJITSUBO Legalis R',type:'Выпуск',price:12500,desc:'Мощность +3.5%, масса −6 кг; тепловая нагрузка +2.5%.',effect:'exhaust'},
 {id:'radiator',name:'KOYORAD Racing Radiator',type:'Радиатор',price:13000,desc:'Теплоотвод +18%, масса +5 кг. Работает вместе с масляным радиатором.',effect:'radiator'},
 {id:'intercooler',turboOnly:true,name:'HKS R-Type Intercooler',type:'Интеркулер',price:19000,desc:'Только турбомотор: мощность +4%, тепловая нагрузка ×0.9, масса +9 кг, сопротивление воздуху +2%.',effect:'intercooler'},
 {id:'flywheel',name:'TODA Racing Flywheel',type:'Лёгкий маховик',price:10500,desc:'Масса −3 кг, паузы передач в дрэге −10%. Тяга на низких оборотах −4%; сочетается со сцеплением.',effect:'flywheel'},
 {id:'pads',name:'ENDLESS MX72',type:'Тормозные колодки',price:7500,desc:'Дорожное торможение +7%, положительный нагрев тормозов ×0.9. Дополняют тормозной комплект, не охлаждают мотор.',effect:'pads'},
 {id:'brace',name:'CUSCO Strut Tower Bar',type:'Распорка кузова',price:6500,desc:'Сцепление +1.5%, отклик угла в дрифте +2%, масса +3 кг. Более резкая реакция требует точности.',effect:'brace'},
 {id:'splitter',name:'Voltex Front Splitter',type:'Передняя аэродинамика',price:11500,desc:'Дополнительное сцепление растёт со скоростью до +3.5%. Сопротивление воздуху +4%, масса +3 кг; сочетается с крылом.',effect:'splitter'}
);
// Workshop alternatives: one part per replaceable hardware slot. Values are game ratings.
for(const part of PARTS)if(['ecu','turbo','cooling','aero','splitter'].includes(part.id))part.slot=part.id;
PARTS.push(
 {id:'enduranceTires',slot:'tires',name:'Endurance Club Compound',type:'Выносливый полуслик',price:16000,reputation:24,desc:'Сухое сцепление +9%, мокрое −1%, износ ×0.72. Дольше живёт, уступает мягкому слику в темпе.',effect:'endurance'},
 {id:'streetEcu',family:'ecu',slot:'ecu',name:'Street ECU Calibration',type:'Умеренная прошивка',price:8000,reputation:12,mod:{power:1.04,heat:1.05},desc:'Мощность +4%, нагрев +5%. Дешевле и спокойнее HKS; заменяет другой ЭБУ.',effect:'power'},
 {id:'responseTurbo',family:'turbo',slot:'turbo',turboOnly:true,name:'Response Turbo Kit',type:'Лёгкий турбокомплект',price:21000,reputation:36,mod:{power:1.12,heat:1.15,wear:1.06,focus:1.04,mass:8},desc:'Для турбомотора: мощность +12%, нагрев +15%, масса +8 кг, износ ×1.06, фокус ×1.04. Заменяет другой турбокомплект.',effect:'boost'},
 {id:'compactOil',family:'cooling',slot:'cooling',name:'Compact Oil Cooler',type:'Компактный маслокулер',price:4500,reputation:12,mod:{cooling:1.15,mass:0},desc:'Теплоотвод масла +15%, без прибавки массы. Бюджетная альтернатива; открывает «Тепловое окно».',effect:'cooling'},
 {id:'raceOil',family:'cooling',slot:'cooling',name:'Endurance Oil Cooler',type:'Гоночный маслокулер',price:19000,reputation:36,mod:{cooling:1.55,mass:6},desc:'Теплоотвод масла +55%, масса +6 кг. Для длительной нагрузки; заменяет другой маслокулер.',effect:'cooling'},
 {id:'brakeDucts',name:'Brake Cooling Ducts',type:'Обдув тормозов',price:6000,reputation:12,desc:'Охлаждение тормозов обдувом +25%, масса +2 кг. Не охлаждает мотор и не заменяет колодки.',effect:'brakeCooling'},
 {id:'streetWing',family:'aero',slot:'aero',name:'Street Low-Drag Wing',type:'Крыло с малым сопротивлением',price:11000,reputation:24,mod:{grip:.055,drag:.06,mass:6},desc:'При стандартном прижиме: сцепление на скорости до +5.5%, сопротивление +6%, масса +6 кг. Заменяет другое крыло.',effect:'aero'},
 {id:'trackWing',family:'aero',slot:'aero',name:'Time Attack GT Wing',type:'Крыло высокого прижима',price:26000,reputation:48,mod:{grip:.15,drag:.24,mass:17},desc:'При стандартном прижиме: сцепление на скорости до +15%, сопротивление +24%, масса +17 кг. Сильнее в дугах, медленнее на прямой.',effect:'aero'},
 {id:'streetLip',family:'splitter',slot:'splitter',name:'Street Front Lip',type:'Лёгкий передний лип',price:6500,reputation:12,mod:{grip:.018,drag:.018,mass:2},desc:'Сцепление на скорости до +1.8%, сопротивление +1.8%, масса +2 кг. Дешевле сплиттера; занимает тот же слот.',effect:'splitter'},
 {id:'flatFloor',name:'Club Flat Floor',type:'Плоское днище',price:21000,reputation:36,desc:'Сцепление на скорости до +3%, сопротивление +1.5%, масса +7 кг. Сочетается с крылом и передним обвесом.',effect:'floor'}
);
export const TUNING_GROUPS = [
 {id:'tires',name:'Шины',description:'Состав под покрытие. Установлен только один комплект.',parts:['streetTires','tires','wetTires','slicks','dragRadial','enduranceTires']},
 {id:'engine',name:'Двигатель',description:'Мощность, рабочий диапазон и цена тепловой нагрузки.',parts:['streetEcu','ecu','responseTurbo','turbo','cams','exhaust']},
 {id:'cooling',name:'Охлаждение',description:'Контроль температуры и стабильность под длительной нагрузкой.',parts:['compactOil','cooling','raceOil','radiator','intercooler','brakeDucts']},
 {id:'transmission',name:'Трансмиссия',description:'Дифференциал, сцепление и выбор главной пары.',parts:['lsd','clutch','flywheel','shortFinal','longFinal','gearbox']},
 {id:'chassis',name:'Шасси и тормоза',description:'Торможение, подвеска, облегчение и дрифтовая геометрия.',parts:['brakes','pads','suspension','brace','weight','angle']},
 {id:'aero',name:'Аэродинамика',description:'Сцепление на скорости в обмен на сопротивление и массу.',parts:['streetWing','aero','trackWing','streetLip','splitter','flatFloor']}
];
export const CARDS = [
 {id:'balanced',name:'Чистый темп',en:'BALANCED PACE',icon:'↗',category:'Темп',desc:'Нейтральная линия без лишнего риска.',gain:0,focus:0,heat:0,wear:1,risk:0},
 {id:'attack',name:'Полная атака',en:'FULL ATTACK',icon:'⚡',category:'Темп',desc:'Потенциал ускорения на любом секторе. Повторы, нагрузка и скольжение могут съесть выигрыш.',gain:.045,focus:17,heat:14,wear:2.2,risk:.18},
 {id:'preserve',name:'Беречь шины',en:'TIRE PRESERVE',icon:'◎',category:'Ресурс',desc:'Небольшая потеря темпа, износ шин ×0.35.',gain:-.035,focus:-6,heat:-7,wear:.35,risk:-.12},
 {id:'cool',name:'Остудить тормоза',en:'COOL BRAKES',icon:'❄',category:'Ресурс',desc:'Уменьшает нагрев тормозов ценой темпа. Итог зависит от торможений, обдува и повторов.',gain:-.045,focus:-4,heat:-24,wear:.65,risk:-.12},
 {id:'breathe',name:'Собраться',en:'RESET FOCUS',icon:'◌',category:'Ресурс',desc:'Восстанавливает 24 концентрации. Спокойный темп.',gain:-.055,focus:-24,heat:-8,wear:.7,risk:-.14},
 {id:'late',name:'Позднее торможение',en:'LATE BRAKING',icon:'↘',category:'Поворот',desc:'Поздний вход. Сильнее с Brembo, опаснее при перегреве.',gain:.045,focus:12,heat:19,wear:1.5,risk:.17,only:'corner'},
 {id:'safe',name:'Надёжный вход',en:'CONSERVATIVE ENTRY',icon:'⌁',category:'Поворот',desc:'Стабильный вход в поворот, особенно в дождь.',gain:-.015,focus:-4,heat:-8,wear:.65,risk:-.24,only:'corner'},
 {id:'apexEarly',name:'Ранний апекс',en:'EARLY APEX',icon:'⌃',category:'Поворот',desc:'Выгодно в тесной связке; хуже перед длинной прямой.',gain:.024,focus:7,heat:3,wear:1.1,risk:.05,only:'corner'},
 {id:'weight',name:'Перенос веса',en:'WEIGHT TRANSFER',icon:'⇄',category:'Поворот',desc:'Разворот машины в связке. TEIN улучшает реализацию.',gain:.029,focus:10,heat:3,wear:1.25,risk:.07,only:'corner'},
 {id:'power',name:'Силовой выход',en:'POWER EXIT',icon:'»',category:'Поворот',desc:'Быстрее выход из поворота. На мокром без LSD легче потерять сцепление; повтор добавляет штраф.',gain:.04,focus:11,heat:6,wear:1.6,risk:.14,only:'corner'},
 {id:'draft',name:'Слипстрим',en:'SLIPSTREAM',icon:'⇢',category:'Дуэль',desc:'Меньше сопротивление за соперником на прямой.',gain:.043,focus:6,heat:4,wear:1,risk:.02,only:'straight',gap:'behind'},
 {id:'study',name:'Изучить соперника',en:'STUDY RIVAL',icon:'◉',category:'Дуэль',desc:'Спокойный сектор; следующее действие получает +1.5% темпа.',gain:-.012,focus:-9,heat:-3,wear:.85,risk:-.08},
 {id:'defend',name:'Закрыть траекторию',en:'DEFEND LINE',icon:'⊣',category:'Дуэль',desc:'Добавляет близкому сопернику 0.35 с; сам теряешь темп и скорость выхода. Не гарантирует защиту от обгона.',gain:-.01,focus:8,heat:2,wear:1.2,risk:.03,gap:'ahead'},
 {id:'apex',name:'Точный апекс',en:'PERFECT APEX',icon:'◇',category:'Характер',desc:'Дисциплина Рэна: чистая дуга без лишней нагрузки.',gain:.035,focus:7,heat:2,wear:.95,risk:-.08,only:'corner',pilot:'ren'},
 {id:'dive',name:'Решающий выпад',en:'COMMIT TO PASS',icon:'↯',category:'Характер',desc:'Атака Аки в повороте. Только в пределах 2.5 с от соперника.',gain:.065,focus:18,heat:16,wear:2,risk:.22,only:'corner',pilot:'aki',gap:'close'},
 {id:'rain',name:'Дождевая линия',en:'RAIN LINE',icon:'☂',category:'Характер',desc:'Юи использует сцепление вне отполированной траектории.',gain:.047,focus:7,heat:0,wear:.85,risk:-.2,only:'wet',pilot:'yui'},
 {id:'thermal',name:'Тепловое окно',en:'THERMAL WINDOW',icon:'≋',category:'Оборудование',desc:'HKS: сохранять тягу без дополнительного нагрева.',gain:.025,focus:6,heat:-12,wear:1,risk:0,part:'cooling'}
];
export const SECTORS = [
 {name:'Старт у чайного дома',type:'straight',label:'Прямая',length:360,radius:0,slope:-.02,wet:.08,base:0},
 {name:'Первый правый',type:'corner',label:'Быстрый поворот',length:280,radius:78,slope:-.035,wet:.18,base:1},
 {name:'Пять шпилек · I',type:'corner',label:'Шпилька',length:240,radius:24,slope:-.07,wet:.32,base:2},
 {name:'Кедровая связка',type:'corner',label:'S-связка',length:330,radius:48,slope:-.035,wet:.1,base:3},
 {name:'Тоннель Касуми',type:'straight',label:'Длинная прямая',length:570,radius:0,slope:-.015,wet:0,base:4},
 {name:'Тень водопада',type:'corner',label:'Мокрая шпилька',length:220,radius:21,slope:-.065,wet:.8,base:5},
 {name:'Последняя перекладка',type:'corner',label:'S-связка',length:350,radius:58,slope:-.04,wet:.25,base:6},
 {name:'Огни у подножия',type:'straight',label:'Финишная прямая',length:420,radius:0,slope:-.02,wet:.05,base:7}
];
// Routes are stylized layouts, not reconstructions of real roads.
export const EVENTS = [
  {
    id:'yokohama',name:'Yokohama Quarter Mile',title:'Йокогама · 402 метра',region:'KANAGAWA',japanese:'横浜',
    mode:'drag',theme:'dragstrip',description:'Закрытая клубная полоса. Прогрев, реакция, power band и последний рывок.',
    unlockStreet:0,unlockRaces:3,prize:20000,participation:6000,rivalCar:'chaser',rivalPilot:'aki',rivalParts:['lsd'],
    sectors:[
      {name:'Предстартовая подготовка',type:'straight',label:'Подготовка',phase:'prep',length:0,radius:0,slope:0,wet:.1},
      {name:'Зелёный · первые 60 ft',type:'straight',label:'Старт',phase:'launch',length:18.288,radius:0,slope:0,wet:.1},
      {name:'Рабочий диапазон',type:'straight',label:'Переключения',phase:'shifts',length:281.712,radius:0,slope:0,wet:.1},
      {name:'Последние 102 метра',type:'straight',label:'Финиш',phase:'finish',length:102.336,radius:0,slope:0,wet:.1}
    ],
    anchors:[[-170,0],[-70,300],[30,600],[130,900],[230,1200]]
  },
  {
    id: 'haruna', name: 'Haruna After Hours', title: 'Спуск Харуна',
    region: 'GUNMA', japanese: '榛名山', mode: 'duel', theme: 'forest',
    description: 'Первый ночной вызов. Узкие связки и мокрая шпилька.',
    unlockStreet: 0, unlockRaces: 0, prize: 18000, participation: 7000,
    rivalCar: 'ae86', rivalPilot: 'aki', rivalParts: [],
    sectors: SECTORS,
    anchors: [[0,0],[160,0],[260,110],[170,210],[-60,230],[-230,330],[-110,420],[130,430],[310,540],[180,650],[-70,670],[-260,790],[-160,900],[80,950],[250,1070],[100,1190]]
  },
  {
    id: 'akagi', name: 'Akagi Red Line', title: 'Хребет Акаги',
    region: 'GUNMA', japanese: '赤城山', mode: 'duel', theme: 'ridge',
    description: 'Длинная дуэль: подъёмы, затяжные дуги и управление нагревом.',
    unlockStreet: 12, unlockRaces: 0, prize: 26000, participation: 9000,
    rivalCar: 'evo', rivalPilot: 'yui', rivalParts: ['brakes'],
    sectors: [
      {name:'Ворота хребта',type:'straight',label:'Подъём',length:420,radius:0,slope:.045,wet:.08},
      {name:'Красная дуга',type:'corner',label:'Затяжной поворот',length:380,radius:95,slope:.025,wet:.18},
      {name:'Мост над ущельем',type:'straight',label:'Прямая',length:480,radius:0,slope:-.02,wet:.3},
      {name:'Внутренняя шпилька',type:'corner',label:'Шпилька',length:250,radius:28,slope:-.05,wet:.25},
      {name:'Северная стена',type:'corner',label:'S-связка',length:370,radius:52,slope:-.045,wet:.45},
      {name:'Плато',type:'straight',label:'Короткая прямая',length:300,radius:0,slope:0,wet:.1},
      {name:'След дождя',type:'corner',label:'Мокрая шпилька',length:230,radius:25,slope:-.06,wet:.75},
      {name:'Двойной левый',type:'corner',label:'S-связка',length:410,radius:62,slope:-.02,wet:.3},
      {name:'Финишный вираж',type:'corner',label:'Быстрый поворот',length:320,radius:86,slope:-.02,wet:.12},
      {name:'Огни города',type:'straight',label:'Финишная прямая',length:560,radius:0,slope:-.03,wet:.05}
    ],
    anchors:[[0,0],[220,30],[320,160],[120,240],[-160,240],[-300,380],[-60,460],[260,410],[310,570],[80,680],[-190,660],[-290,840],[-20,950],[200,900],[310,1080],[80,1200]]
  },
  {
    id: 'tsukuba', name: 'Tsukuba Club Time Attack', title: 'Клубный день в Цукубе',
    region: 'IBARAKI', japanese: '筑波', mode: 'timeattack', theme: 'circuit',
    description: 'Официальная сессия на время. Чистая трасса, медали и свой призрак.',
    unlockStreet: 0, unlockRaces: 2, prize: 16000, participation: 4500,
    rivalCar: 'ae86', rivalPilot: 'ren', rivalParts: [],
    sectors: [
      {name:'Стартовая прямая',type:'straight',label:'Главная прямая',length:320,radius:0,slope:0,wet:.05},
      {name:'Первый поворот',type:'corner',label:'Поворот 1',length:270,radius:52,slope:0,wet:.15},
      {name:'Dunlop',type:'corner',label:'Быстрая связка',length:340,radius:85,slope:.01,wet:.12},
      {name:'Вторая шпилька',type:'corner',label:'Шпилька',length:230,radius:28,slope:0,wet:.28},
      {name:'Задняя прямая',type:'straight',label:'Длинная прямая',length:437,radius:0,slope:0,wet:.02},
      {name:'Последний поворот',type:'corner',label:'Затяжная дуга',length:448,radius:120,slope:0,wet:.1}
    ],
    anchors:[[-240,50],[150,50],[320,180],[160,320],[-100,300],[-280,450],[-130,610],[150,580],[300,760],[180,900],[-150,950],[-330,800],[-350,400],[-240,50]]
  }
];
EVENTS.push(EVENTS.shift());
EVENTS.push({
  id:'ebisu',name:'Ebisu Club Drift',title:'Эбису · искусство связки',region:'FUKUSHIMA',japanese:'エビス',
  mode:'drift',theme:'driftpark',description:'Судейская сессия: две связки по четыре клипа. Линия, угол, скорость и непрерывность.',
  unlockStreet:20,unlockRaces:0,prize:22000,participation:5500,rivalCar:'ae86',rivalPilot:'ren',rivalParts:[],
  medals:{gold:710,silver:620,bronze:480},
  sectors:[
    {name:'Вход в южную дугу',type:'corner',label:'Инициация',phase:'init',clip:'Внешняя зона',length:110,radius:42,targetAngle:40,targetSpeed:68,direction:1,slope:0,wet:.12},
    {name:'Удержание у ограждения',type:'corner',label:'Удержание',phase:'hold',clip:'Внешняя зона',length:150,radius:55,targetAngle:46,targetSpeed:74,direction:1,slope:0,wet:.18},
    {name:'Левый клип',type:'corner',label:'Перекладка',phase:'transition',clip:'Внутренний клип',length:110,radius:40,targetAngle:42,targetSpeed:65,direction:-1,slope:0,wet:.25},
    {name:'Выход к паддоку',type:'corner',label:'Выход',phase:'exit',clip:'Выходная зона',length:135,radius:70,targetAngle:18,targetSpeed:82,direction:-1,slope:0,wet:.08},
    {name:'Вход в северную дугу',type:'corner',label:'Инициация',phase:'init',clip:'Внешняя зона',length:100,radius:38,targetAngle:54,targetSpeed:64,direction:-1,slope:0,wet:.25},
    {name:'Длинная скользящая дуга',type:'corner',label:'Удержание',phase:'hold',clip:'Внешняя зона',length:180,radius:65,targetAngle:60,targetSpeed:79,direction:-1,slope:0,wet:.35},
    {name:'Правая перекладка',type:'corner',label:'Перекладка',phase:'transition',clip:'Внутренний клип',length:115,radius:43,targetAngle:50,targetSpeed:68,direction:1,slope:0,wet:.2},
    {name:'Финишный клип',type:'corner',label:'Выход',phase:'exit',clip:'Выходная зона',length:140,radius:75,targetAngle:20,targetSpeed:86,direction:1,slope:0,wet:.1}
  ],
  anchors:[[0,0],[220,80],[260,240],[20,310],[-260,330],[-300,530],[-80,620],[210,610],[300,800],[50,920],[-200,950],[-220,1140],[100,1200]]
});

// Half-mile and mile share the closed strip, but not their high-speed decisions.
for(const spec of [
  {id:'yokohama-half',name:'Yokohama Half Mile',title:'Йокогама · 804 м',distance:804.672,unlockRaces:4,prize:24000,participation:7000,
    pulls:[{end:600,name:'Вторая половина разгона'}]},
  {id:'yokohama-mile',name:'Yokohama Standing Mile',title:'Йокогама · 1 миля',distance:1609.344,unlockRaces:5,prize:30000,participation:8500,
    pulls:[{end:600,name:'Выход на высокую скорость'},{end:1000,name:'Тепловая нагрузка'},{end:1400,name:'Подготовка финального рывка'}]}
]){
  const base=EVENTS.find(event=>event.id==='yokohama');
  const sectors=base.sectors.slice(0,3).map(sector=>({...sector}));
  let start=300;
  for(const pull of spec.pulls){sectors.push({name:pull.name,type:'straight',label:'Длинный разгон',phase:'pull',length:pull.end-start,radius:0,slope:0,wet:.1});start=pull.end;}
  sectors.push({name:'Финиш длинной дистанции',type:'straight',label:'Финиш',phase:'finish',length:spec.distance-start,radius:0,slope:0,wet:.1});
  EVENTS.push({...base,...spec,longDrag:true,description:spec.id==='yokohama-half'?'Полмили: стартовая тяга против запаса по оборотам и охлаждению.':'Стоячая миля: три окна решений на высокой скорости и борьба за ресурс мотора.',
    sectors:sectors.map(sector=>({...sector,longDrag:true,totalDistance:spec.distance}))});
}
// Expanded venues use authored, stylized layouts, never exact real-road replicas.
const roadSector=(name,length,radius,slope,wet)=>({name,length,radius,slope,wet,type:radius?'corner':'straight',label:radius?(radius<35?'Шпилька':radius<70?'Техническая связка':'Быстрая дуга'):(slope>.02?'Подъём':'Прямая')});
EVENTS.push(
 {id:'irohazaka',name:'Irohazaka Switchbacks',title:'Ирохадзака · каскад шпилек',region:'TOCHIGI',japanese:'いろは坂',mode:'duel',theme:'forest',unlockStreet:28,unlockRaces:5,prize:30000,participation:9500,rivalCar:'rx7',rivalPilot:'ren',rivalParts:['brakes','lsd'],description:'Тесный спуск: десять секторов, короткие разгоны и каскад торможений. Масса и запас тормозов важнее пиковой мощности.',
  sectors:[roadSector('Точка обзора',260,0,-.025,.1),roadSector('Первая петля',180,23,-.06,.2),roadSector('Левая у стены',200,27,-.055,.3),roadSector('Разгон под кедрами',290,0,-.04,.12),roadSector('Двойной радиус',240,39,-.045,.4),roadSector('Узкий мостик',200,0,-.015,.5),roadSector('Моховая шпилька',190,21,-.065,.65),roadSector('Обратная петля',210,29,-.05,.3),roadSector('Выход из леса',280,55,-.03,.15),roadSector('Финиш у станции',330,0,-.02,.08)],
  anchors:[[0,0],[180,80],[220,190],[-180,230],[-230,340],[190,390],[240,510],[-190,560],[-240,680],[150,740],[190,860],[-120,930],[0,1050]]},
 {id:'hakone',name:'Hakone Skyline Run',title:'Хаконе · линия горизонта',region:'KANAGAWA',japanese:'箱根',mode:'duel',theme:'ridge',unlockStreet:36,unlockRaces:7,prize:32000,participation:10000,rivalCar:'nsx',rivalPilot:'yui',rivalParts:['aero','brakes'],description:'Быстрые открытые дуги, подъём к перевалу и разгрузка на спуске. Аэродинамика помогает, пока не мешает разгону.',
  sectors:[roadSector('Подъём к перевалу',620,0,.045,.12),roadSector('Панорамная дуга',480,125,.02,.18),roadSector('Открытый гребень',650,0,.01,.32),roadSector('Ветер с озера',430,105,-.015,.38),roadSector('Слепой правый',310,68,-.035,.25),roadSector('Спуск к развилке',570,0,-.045,.08),roadSector('Дуга у смотровой',440,96,-.025,.3),roadSector('Огни перевала',560,0,-.01,.1)],
  anchors:[[0,0],[280,100],[440,300],[260,520],[-80,660],[-260,880],[-100,1100],[240,1240],[420,1460],[210,1640],[-50,1760]]},
 {id:'wangan',name:'Wangan Closed Night',title:'Ванган · ночная магистраль',region:'TOKYO BAY',japanese:'湾岸',mode:'duel',theme:'highway',unlockStreet:44,unlockRaces:9,prize:35000,participation:10500,rivalCar:'supra',rivalPilot:'aki',rivalParts:['ecu','cooling','longFinal'],description:'Закрытый ночной участок у залива: затяжные разгоны, скоростные дуги, слипстрим и тепловая дисциплина. Это дуэль, не дрэг.',
  sectors:[roadSector('Старт у терминала',760,0,0,.08),roadSector('Свет портовых кранов',950,0,.005,.12),roadSector('Северная эстакада',650,280,.01,.2),roadSector('Длинный тоннель',1100,0,-.005,0),roadSector('Поворот у залива',700,240,0,.35),roadSector('Мостовые огни',900,0,.012,.25),roadSector('Съезд к терминалу',520,150,-.02,.18),roadSector('Финишная линия',800,0,0,.08)],
  anchors:[[0,0],[50,300],[130,700],[260,1050],[330,1450],[300,1850],[210,2250],[100,2600],[60,3000],[160,3400]]},
 {id:'nikko',name:'Nikko Technical Session',title:'Никко · техническая сессия',region:'TOCHIGI',japanese:'日光',mode:'timeattack',theme:'circuit',unlockStreet:0,unlockRaces:4,prize:23000,participation:7500,rivalCar:'ek9',rivalPilot:'ren',rivalParts:[],description:'Короткий технический Time Attack. Медленные выходы, одна скоростная дуга и точное торможение под лёгкие машины.',
  sectors:[roadSector('Пит-уолл',220,0,0,.05),roadSector('Первый разворот',150,29,0,.18),roadSector('Короткая связка',190,44,0,.15),roadSector('Задняя прямая',310,0,0,.08),roadSector('Скоростной правый',250,82,0,.25),roadSector('Тормозной карман',160,24,0,.2),roadSector('Обратный апекс',190,38,0,.3),roadSector('Финиш перед боксами',230,0,0,.05)],
  anchors:[[0,0],[300,0],[380,120],[260,240],[-70,220],[-240,330],[-220,520],[80,570],[270,450],[180,340],[0,420],[-50,650],[230,750]]},
 {id:'meihan',name:'Meihan Precision Drift',title:'Мэйхан · точность у стены',region:'NARA',japanese:'名阪',mode:'drift',theme:'driftpark',unlockStreet:32,unlockRaces:6,prize:27000,participation:8000,rivalCar:'s13',rivalPilot:'aki',rivalParts:['lsd'],description:'Две компактные дрифтовые связки: вход у стены, тесные перекладки и контроль скорости. Оценивается точность, а не максимальный угол.',medals:{gold:700,silver:610,bronze:470},
  sectors:[['Стена первого входа','init',105,35,48,61,1,.1],['Внешняя зона','hold',140,48,52,68,1,.15],['Узкая перекладка','transition',95,32,44,58,-1,.2],['Выход к боксам','exit',120,58,20,72,-1,.08],['Второй вход у стены','init',100,33,50,60,-1,.18],['Длинный внешний клип','hold',155,52,55,72,-1,.3],['Обратная перекладка','transition',100,36,46,62,1,.2],['Чистый финиш','exit',130,62,18,76,1,.1]].map(([name,phase,length,radius,targetAngle,targetSpeed,direction,wet])=>({name,phase,length,radius,targetAngle,targetSpeed,direction,wet,type:'corner',slope:0,label:{init:'Инициация',hold:'Удержание',transition:'Перекладка',exit:'Выход'}[phase],clip:phase==='exit'?'Выходная зона':phase==='transition'?'Внутренний клип':'Внешняя зона'})),
  anchors:[[0,0],[250,40],[280,220],[20,290],[-190,420],[-170,610],[90,680],[300,620],[350,830],[80,940],[-120,1090]]}
);
// Original stylized centerlines based on the official course guides; sector radii are game approximations.
const circuitSector=(name,length,radius=0,slope=0)=>roadSector(name,length,radius,slope,.12);
EVENTS.push(
 {id:'suzuka',name:'Suzuka GP Circuit',title:'Судзука · полный круг',region:'MIE',japanese:'鈴鹿',mode:'timeattack',theme:'circuit',realCircuit:true,officialLength:5807,cornerCount:18,unlockStreet:0,unlockRaces:6,prize:31000,participation:9500,rivalCar:'nsx',rivalPilot:'ren',rivalParts:[],source:'https://www.suzukacircuit.jp/eng/course_s/',description:'Полный круг Судзуки: S-связки, Degner, шпилька, Spoon, 130R и финальная шикана. Стилизованная схема; 12 игровых участков, 18 реальных поворотов.',
 sectors:[circuitSector('Главная прямая',650),circuitSector('Первый и второй повороты',420,65,-.015),circuitSector('S-связки',650,62,.025),circuitSector('Dunlop',480,110,.02),circuitSector('Degner 1–2',380,43,-.02),circuitSector('Шпилька',270,25,-.015),circuitSector('200R',650,200,.01),circuitSector('Spoon',500,68,.015),circuitSector('Западная прямая',720),circuitSector('130R',400,130,-.01),circuitSector('Финальная шикана',250,28),circuitSector('Последний поворот и финиш',437,95,-.02)],
 anchors:[[330,450],[160,428],[120,414],[106,383],[114,364],[134,361],[178,378],[210,387],[246,363],[274,375],[310,390],[352,366],[385,365],[410,390],[432,441],[488,426],[518,397],[528,354],[529,281],[577,234],[624,272],[678,321],[693,362],[705,364],[700,288],[722,242],[775,212],[820,200],[870,211],[926,238],[950,224],[970,195],[955,175],[890,172],[800,185],[700,221],[602,260],[578,289],[548,354],[533,403],[515,440],[500,455],[490,451],[479,471],[442,484],[385,469],[330,450]].map(([x,y])=>[x*4,y*4]),crossing:[603*4,260*4]},
 {id:'fuji',name:'Fuji Speedway',title:'Фудзи · Grand Prix',region:'SHIZUOKA',japanese:'富士',mode:'timeattack',theme:'circuit',realCircuit:true,officialLength:4563,cornerCount:17,unlockStreet:0,unlockRaces:4,prize:28500,participation:8500,rivalCar:'supra',rivalPilot:'ren',rivalParts:[],source:'https://www.fsw.tv/guide/facility/racing.html',description:'Прямая 1 475 м, торможение в TGR, 100R, шпилька ADVAN и технический подъём к последнему повороту. Стилизованная схема; 12 игровых участков, 17 реальных поворотов.',
 sectors:[circuitSector('Главная прямая · 1 475 м',1475),circuitSector('TGR · первый поворот',225,30,-.06),circuitSector('Разгон после TGR',320,0,-.03),circuitSector('Coca-Cola',210,65,-.035),circuitSector('100R',410,100),circuitSector('ADVAN · шпилька',180,27,.02),circuitSector('300R',500,300,-.015),circuitSector('Dunlop · шикана',190,28),circuitSector('Технический подъём',300,48,.05),circuitSector('GR Supra',180,36,.04),circuitSector('GR GT',240,45,.03),circuitSector('Panasonic · выход к финишу',333,65,.015)],
 anchors:[[270,42],[440,60],[507,67],[523,72],[521,78],[490,87],[370,92],[345,99],[323,126],[300,138],[273,141],[248,135],[235,123],[235,110],[250,84],[260,72],[245,70],[210,82],[175,103],[135,110],[96,112],[59,99],[32,92],[45,77],[45,70],[53,60],[65,50],[80,50],[99,53],[116,49],[125,40],[106,35],[84,29],[82,21],[90,17],[110,19],[270,42]].map(([x,y])=>[x*5,y*5])}
);
// The same street venue supports a timed touge duel and judged drift zones.
for(const base of EVENTS.filter(e=>e.mode==='duel')){
 base.venueId=base.id;base.streetVenue=true;
 const total=base.sectors.reduce((n,s)=>n+s.length,0),corners=base.sectors.filter(s=>s.radius>0);
 EVENTS.push({...base,id:base.id+'-drift',venueId:base.id,name:base.name+' · Drift',title:base.title+' · дрифт',mode:'drift',prize:Math.round(base.prize*.85),participation:Math.round(base.participation*.85),medals:{gold:700,silver:600,bronze:460},description:'Дрифт на том же уличном маршруте. Восемь судейских зон: траектория, угол, скорость и связность. '+base.description,
 sectors:Array.from({length:8},(_,i)=>{const phase=['init','hold','transition','exit'][i%4],source=corners[i%corners.length],radius=Math.max(30,Math.min(85,source.radius)),direction=[1,1,-1,-1,-1,-1,1,1][i];return {name:'Зона '+(i+1)+' · '+source.name,type:'corner',label:{init:'Инициация',hold:'Удержание',transition:'Перекладка',exit:'Выход'}[phase],phase,clip:phase==='exit'?'Выходная зона':phase==='transition'?'Внутренний клип':'Внешняя зона',length:total/8,radius,slope:source.slope,wet:source.wet,direction,targetAngle:phase==='exit'?20:phase==='hold'?50:42,targetSpeed:Math.round(Math.max(56,Math.min(84,Math.sqrt(radius*9.81)*3.6*.9))) };})});
}
export const DISCIPLINES=[{id:'duel',name:'Тогу · дуэль'},{id:'drift',name:'Дрифт'},{id:'drag',name:'Дрэг'},{id:'timeattack',name:'Time Attack'}];
const roadLayouts=new Map();
export function getEvent(id = 'haruna',routeVersion=1) {
 const event=EVENTS.find(event=>event.id===id)||EVENTS[0];
 if(![2,3].includes(routeVersion)||!['duel','timeattack'].includes(event.mode))return event;
 const key=event.id+':'+routeVersion;
 if(!roadLayouts.has(key))roadLayouts.set(key,routeVersion===3?authoredRoad(event):segmentRoad(event));return roadLayouts.get(key);
}
export function sectorAt(index, weather = 'mixed', eventId = 'haruna',routeVersion=1) {
  const original = getEvent(eventId,routeVersion).sectors[index];
  if (!original) throw new Error('Сектор отсутствует');
  const sector = {...original};
  sector.wet = weather === 'dry' ? 0 : weather === 'rain' ? Math.min(1, sector.wet + .55) : sector.wet;
  sector.mode = getEvent(eventId,routeVersion).mode;
  return sector;
}
export function eventLength(event) {
  return event.sectors.reduce((sum, sector) => sum + sector.length, 0);
}
