export const CARS = [
 {id:'ae86',brand:'TOYOTA',name:'Sprinter Trueno AE86',year:1986,tag:'Лёгкий FR',drive:'FR',power:130,mass:940,grip:1.02,brakes:1.0,cooling:1.0,color:'#eee8d9',price:0,engine:'4A-GE · 1.6 L · NA',description:'Лёгкий кузов и точная смена направления. Прощает меньше ошибок на мокром выходе, зато бережёт тормоза.'},
 {id:'chaser',brand:'TOYOTA',name:'Chaser Tourer V JZX100',year:1996,tag:'Мощный FR',drive:'FR',power:280,mass:1470,grip:1.0,brakes:.96,cooling:.9,color:'#944fff',price:45000,engine:'1JZ-GTE · 2.5 L · TURBO',description:'Тяга турбошестёрки решает на прямых. Масса нагружает тормоза, а мокрые шпильки требуют терпения.'},
 {id:'evo',brand:'MITSUBISHI',name:'Lancer Evolution VI',year:1999,tag:'Устойчивый AWD',drive:'AWD',power:280,mass:1360,grip:1.09,brakes:1.06,cooling:1.05,color:'#e34b43',price:60000,engine:'4G63T · 2.0 L · TURBO',description:'Полный привод раньше реализует тягу на мокром асфальте. Тяжелее AE86 и быстрее расходует передние шины.'},
 {id:'mx5',brand:'MAZDA',name:'Eunos Roadster NA6CE',year:1989,tag:'Лёгкий родстер',drive:'FR',power:120,mass:940,grip:1.04,brakes:1.0,cooling:1.04,color:'#3a9e6f',price:24000,engine:'B6-ZE · 1.6 L · NA',description:'Дешёвый лёгкий родстер: точные связки и умеренный расход шин. На длинной прямой не хватает мощности.'},
 {id:'s13',brand:'NISSAN',name:"Silvia K’s S13",year:1991,tag:'Сбалансированный турбо FR',drive:'FR',power:205,mass:1170,grip:1.03,brakes:1.0,cooling:.98,color:'#83b8b0',price:38000,engine:'SR20DET · 2.0 L · TURBO',description:'Промежуточная ступень между AE86 и мощными купе. Подходит для дрифта и наращивания турбонаддува.'},
 {id:'rx7',brand:'MAZDA',name:'RX-7 Type RS FD3S',year:1999,tag:'Роторное купе',drive:'FR',power:280,mass:1280,grip:1.08,brakes:1.05,cooling:.82,color:'#f2c64f',price:78000,engine:'13B-REW · 1.3 L · TWIN TURBO',description:'Быстрое лёгкое купе для дуг и дрифта. Роторный мотор требует особенно внимательного охлаждения.'},
 {id:'r32',brand:'NISSAN',name:'Skyline GT-R BNR32',year:1991,tag:'Тяжёлый AWD',drive:'AWD',power:280,mass:1430,grip:1.08,brakes:1.04,cooling:.98,color:'#74829a',price:82000,engine:'RB26DETT · 2.6 L · TWIN TURBO',description:'Уверенный старт и тяга в дождь. Масса и сложный полный привод увеличивают расход ресурса.'},
 {id:'supra',brand:'TOYOTA',name:'Supra RZ JZA80',year:1993,tag:'Турбо GT',drive:'FR',power:280,mass:1510,grip:1.02,brakes:1.03,cooling:1.03,color:'#d5dbe0',price:85000,engine:'2JZ-GTE · 3.0 L · TWIN TURBO',description:'Тяжёлое мощное GT с шестиступенчатой коробкой. Хорошая основа для дрэга, сложнее в тесных связках.'},
 {id:'ek9',brand:'HONDA',name:'Civic Type R EK9',year:1997,tag:'Высокооборотный FF',drive:'FF',power:185,mass:1070,grip:1.07,brakes:1.03,cooling:1.08,color:'#f0f0db',price:40000,engine:'B16B · 1.6 L · NA',description:'Лёгкий переднеприводный хэтчбек для Time Attack. Передние колёса совмещают поворот и тягу; устойчивый силовой дрифт даётся плохо.'},
 {id:'nsx',brand:'HONDA',name:'NSX NA1',year:1990,tag:'Среднемоторный MR',drive:'MR',power:280,mass:1350,grip:1.12,brakes:1.08,cooling:1.0,color:'#eb6547',price:110000,engine:'C30A · 3.0 L · NA',description:'Точная среднемоторная машина с сильным сцеплением. Быстрый отклик полезен в связках, но требует аккуратности на пределе.'}
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
export const TUNING_GROUPS = [
 {id:'tires',name:'Шины',description:'Состав под покрытие. Установлен только один комплект.',parts:['tires','wetTires','slicks']},
 {id:'engine',name:'Двигатель',description:'Мощность, рабочий диапазон и цена тепловой нагрузки.',parts:['ecu','turbo','cams']},
 {id:'cooling',name:'Охлаждение',description:'Контроль температуры и стабильность под длительной нагрузкой.',parts:['cooling']},
 {id:'transmission',name:'Трансмиссия',description:'Дифференциал, сцепление и выбор главной пары.',parts:['lsd','clutch','shortFinal','longFinal','gearbox']},
 {id:'chassis',name:'Шасси и тормоза',description:'Торможение, подвеска, облегчение и дрифтовая геометрия.',parts:['brakes','suspension','weight','angle']},
 {id:'aero',name:'Аэродинамика',description:'Сцепление на скорости в обмен на сопротивление и массу.',parts:['aero']}
];
export const CARDS = [
 {id:'balanced',name:'Чистый темп',en:'BALANCED PACE',icon:'↗',category:'Темп',desc:'Нейтральная линия без лишнего риска.',gain:0,focus:0,heat:0,wear:1,risk:0},
 {id:'attack',name:'Полная атака',en:'FULL ATTACK',icon:'⚡',category:'Темп',desc:'Быстрее на любом секторе. Высокая нагрузка на ресурсы.',gain:.045,focus:17,heat:14,wear:2.2,risk:.18},
 {id:'preserve',name:'Беречь шины',en:'TIRE PRESERVE',icon:'◎',category:'Ресурс',desc:'Небольшая потеря темпа, износ шин ×0.35.',gain:-.035,focus:-6,heat:-7,wear:.35,risk:-.12},
 {id:'cool',name:'Остудить тормоза',en:'COOL BRAKES',icon:'❄',category:'Ресурс',desc:'Снижает температуру тормозов на 24°C ценой времени.',gain:-.045,focus:-4,heat:-24,wear:.65,risk:-.12},
 {id:'breathe',name:'Собраться',en:'RESET FOCUS',icon:'◌',category:'Ресурс',desc:'Восстанавливает 24 концентрации. Спокойный темп.',gain:-.055,focus:-24,heat:-8,wear:.7,risk:-.14},
 {id:'late',name:'Позднее торможение',en:'LATE BRAKING',icon:'↘',category:'Поворот',desc:'Поздний вход. Сильнее с Brembo, опаснее при перегреве.',gain:.045,focus:12,heat:19,wear:1.5,risk:.17,only:'corner'},
 {id:'safe',name:'Надёжный вход',en:'CONSERVATIVE ENTRY',icon:'⌁',category:'Поворот',desc:'Стабильный вход в поворот, особенно в дождь.',gain:-.015,focus:-4,heat:-8,wear:.65,risk:-.24,only:'corner'},
 {id:'apexEarly',name:'Ранний апекс',en:'EARLY APEX',icon:'⌃',category:'Поворот',desc:'Выгодно в тесной связке; хуже перед длинной прямой.',gain:.024,focus:7,heat:3,wear:1.1,risk:.05,only:'corner'},
 {id:'weight',name:'Перенос веса',en:'WEIGHT TRANSFER',icon:'⇄',category:'Поворот',desc:'Разворот машины в связке. TEIN улучшает реализацию.',gain:.029,focus:10,heat:3,wear:1.25,risk:.07,only:'corner'},
 {id:'power',name:'Силовой выход',en:'POWER EXIT',icon:'»',category:'Поворот',desc:'Реализовать тягу. AWD и LSD уменьшают пробуксовку.',gain:.04,focus:11,heat:6,wear:1.6,risk:.14,only:'corner'},
 {id:'draft',name:'Слипстрим',en:'SLIPSTREAM',icon:'⇢',category:'Дуэль',desc:'Меньше сопротивление за соперником на прямой.',gain:.043,focus:6,heat:4,wear:1,risk:.02,only:'straight',gap:'behind'},
 {id:'study',name:'Изучить соперника',en:'STUDY RIVAL',icon:'◉',category:'Дуэль',desc:'Спокойный сектор; следующее действие получает +1.5% темпа.',gain:-.012,focus:-9,heat:-3,wear:.85,risk:-.08},
 {id:'defend',name:'Закрыть траекторию',en:'DEFEND LINE',icon:'⊣',category:'Дуэль',desc:'Сдерживает близкого соперника на 0.35 с; сам теряешь темп.',gain:-.01,focus:8,heat:2,wear:1.2,risk:.03,gap:'ahead'},
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
    rivalCar: 'chaser', rivalPilot: 'aki', rivalParts: [],
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
export function getEvent(id = 'haruna') {
  return EVENTS.find(event => event.id === id) || EVENTS[0];
}
export function sectorAt(index, weather = 'mixed', eventId = 'haruna') {
  const original = getEvent(eventId).sectors[index];
  if (!original) throw new Error('Сектор отсутствует');
  const sector = {...original};
  sector.wet = weather === 'dry' ? 0 : weather === 'rain' ? Math.min(1, sector.wet + .55) : sector.wet;
  sector.mode = getEvent(eventId).mode;
  return sector;
}
export function eventLength(event) {
  return event.sectors.reduce((sum, sector) => sum + sector.length, 0);
}
