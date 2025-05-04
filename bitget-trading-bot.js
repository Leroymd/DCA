// BitGet Trading Bot
// Полная версия для торговли на бирже BitGet

// Структура проекта:
// 1. backend/ - Серверная часть (Node.js, Express)
//    - server.js - Основной файл сервера
//    - api/ - API маршруты
//    - services/ - Бизнес-логика
//    - config/ - Конфигурация
// 2. frontend/ - Клиентская часть (React)
//    - src/ - Исходный код
//      - components/ - Компоненты
//      - pages/ - Страницы
//      - services/ - Сервисы для взаимодействия с API
//      - utils/ - Утилиты

////////////////////////////////////////////////////////////
// BACKEND
////////////////////////////////////////////////////////////

// backend/server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const apiRoutes = require('./api/routes');
const config = require('./config');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// API маршруты
app.use('/api', apiRoutes);

// Подключение к базе данных
mongoose.connect(config.dbUri)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));

// Запуск сервера
const PORT = config.port || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// backend/config/index.js
module.exports = {
  port: process.env.PORT || 5000,
  dbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/bitget-bot',
  bitget: {
    apiUrl: 'https://api.bitget.com',
    apiKey: process.env.BITGET_API_KEY || '',
    secretKey: process.env.BITGET_SECRET_KEY || '',
    passphrase: process.env.BITGET_PASSPHRASE || '',
    demo: process.env.BITGET_DEMO === 'true'
  }
};

// backend/api/routes.js
const express = require('express');
const router = express.Router();
const botController = require('./controllers/botController');
const accountController = require('./controllers/accountController');
const marketController = require('./controllers/marketController');

// Маршруты для бота
router.post('/bot/start', botController.startBot);
router.post('/bot/stop', botController.stopBot);
router.get('/bot/status', botController.getBotStatus);
router.post('/bot/config', botController.updateConfig);
router.get('/bot/config', botController.getConfig);
router.get('/bot/stats', botController.getStats);

// Маршруты для аккаунта
router.get('/account/balance', accountController.getBalance);
router.get('/account/positions', accountController.getPositions);
router.get('/account/orders', accountController.getOrders);

// Маршруты для рыночных данных
router.get('/market/symbols', marketController.getSymbols);
router.get('/market/klines/:symbol', marketController.getKlines);
router.get('/market/ticker/:symbol', marketController.getTicker);

module.exports = router;

// backend/api/controllers/botController.js
const Bot = require('../../services/Bot');
const BotConfig = require('../models/BotConfig');

let activeBots = {};

exports.startBot = async (req, res) => {
  try {
    const { symbol, config } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    if (activeBots[symbol]) {
      return res.status(400).json({ error: 'Bot already running for this symbol' });
    }

    // Получаем конфигурацию из базы данных или используем предоставленную
    let botConfig = config;
    if (!config) {
      const savedConfig = await BotConfig.findOne({ symbol });
      if (savedConfig) {
        botConfig = savedConfig.config;
      } else {
        return res.status(400).json({ error: 'No configuration found for this symbol' });
      }
    }

    // Создаем новый экземпляр бота
    const bot = new Bot(symbol, botConfig);
    await bot.initialize();
    
    // Запускаем бота
    bot.start();
    
    // Сохраняем бота в активных ботах
    activeBots[symbol] = bot;
    
    res.json({ success: true, message: `Bot started for ${symbol}` });
  } catch (error) {
    console.error('Error starting bot:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.stopBot = async (req, res) => {
  try {
    const { symbol } = req.body;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    if (!activeBots[symbol]) {
      return res.status(400).json({ error: 'No active bot found for this symbol' });
    }

    // Останавливаем бота
    await activeBots[symbol].stop();
    
    // Удаляем из активных ботов
    delete activeBots[symbol];
    
    res.json({ success: true, message: `Bot stopped for ${symbol}` });
  } catch (error) {
    console.error('Error stopping bot:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getBotStatus = async (req, res) => {
  try {
    const { symbol } = req.query;
    
    if (!symbol) {
      // Возвращаем статус всех ботов
      const statuses = {};
      for (const [sym, bot] of Object.entries(activeBots)) {
        statuses[sym] = {
          running: bot.isRunning(),
          uptime: bot.getUptime(),
          stats: bot.getStats()
        };
      }
      return res.json(statuses);
    }

    if (!activeBots[symbol]) {
      return res.json({ running: false });
    }

    res.json({
      running: activeBots[symbol].isRunning(),
      uptime: activeBots[symbol].getUptime(),
      stats: activeBots[symbol].getStats()
    });
  } catch (error) {
    console.error('Error getting bot status:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateConfig = async (req, res) => {
  try {
    const { symbol, config } = req.body;
    
    if (!symbol || !config) {
      return res.status(400).json({ error: 'Symbol and config are required' });
    }

    // Обновляем конфигурацию в базе данных
    let botConfig = await BotConfig.findOne({ symbol });
    if (botConfig) {
      botConfig.config = config;
      await botConfig.save();
    } else {
      botConfig = new BotConfig({ symbol, config });
      await botConfig.save();
    }

    // Если бот активен, обновляем его конфигурацию
    if (activeBots[symbol]) {
      activeBots[symbol].updateConfig(config);
    }
    
    res.json({ success: true, message: `Configuration updated for ${symbol}` });
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getConfig = async (req, res) => {
  try {
    const { symbol } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    const botConfig = await BotConfig.findOne({ symbol });
    if (!botConfig) {
      return res.status(404).json({ error: 'No configuration found for this symbol' });
    }
    
    res.json(botConfig.config);
  } catch (error) {
    console.error('Error getting config:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getStats = async (req, res) => {
  try {
    const { symbol } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    if (!activeBots[symbol]) {
      return res.status(404).json({ error: 'No active bot found for this symbol' });
    }
    
    const stats = activeBots[symbol].getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: error.message });
  }
};

// backend/api/controllers/accountController.js
const BitgetAPI = require('../../services/BitgetAPI');

exports.getBalance = async (req, res) => {
  try {
    const api = new BitgetAPI();
    const balance = await api.getAccountBalance();
    res.json(balance);
  } catch (error) {
    console.error('Error getting balance:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getPositions = async (req, res) => {
  try {
    const { symbol } = req.query;
    const api = new BitgetAPI();
    const positions = await api.getPositions(symbol);
    res.json(positions);
  } catch (error) {
    console.error('Error getting positions:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getOrders = async (req, res) => {
  try {
    const { symbol, status, limit } = req.query;
    const api = new BitgetAPI();
    const orders = await api.getOrders(symbol, status, limit);
    res.json(orders);
  } catch (error) {
    console.error('Error getting orders:', error);
    res.status(500).json({ error: error.message });
  }
};

// backend/api/controllers/marketController.js
const BitgetAPI = require('../../services/BitgetAPI');

exports.getSymbols = async (req, res) => {
  try {
    const api = new BitgetAPI();
    const symbols = await api.getSymbols();
    res.json(symbols);
  } catch (error) {
    console.error('Error getting symbols:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getKlines = async (req, res) => {
  try {
    const { symbol } = req.params;
    const { interval, limit } = req.query;
    
    const api = new BitgetAPI();
    const klines = await api.getKlines(symbol, interval, limit);
    res.json(klines);
  } catch (error) {
    console.error('Error getting klines:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getTicker = async (req, res) => {
  try {
    const { symbol } = req.params;
    
    const api = new BitgetAPI();
    const ticker = await api.getTicker(symbol);
    res.json(ticker);
  } catch (error) {
    console.error('Error getting ticker:', error);
    res.status(500).json({ error: error.message });
  }
};

// backend/api/models/BotConfig.js
const mongoose = require('mongoose');

const botConfigSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    unique: true
  },
  config: {
    timeframe: String,
    leverage: Number,
    initialBalance: Number,
    trailingStop: Number,
    maxDCAOrders: Number,
    dcaPriceStep: Number,
    dcaMultiplier: Number,
    maxTradeDuration: Number,
    reinvestment: Number,
    enabled: Boolean
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Обновление даты при изменении
botConfigSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('BotConfig', botConfigSchema);

// backend/api/models/Trade.js
const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true
  },
  botId: {
    type: String,
    required: true
  },
  direction: {
    type: String,
    enum: ['LONG', 'SHORT'],
    required: true
  },
  entryPrice: {
    type: Number,
    required: true
  },
  exitPrice: {
    type: Number
  },
  quantity: {
    type: Number,
    required: true
  },
  entryTime: {
    type: Date,
    default: Date.now
  },
  exitTime: {
    type: Date
  },
  profitLoss: {
    type: Number
  },
  status: {
    type: String,
    enum: ['OPEN', 'CLOSED'],
    default: 'OPEN'
  },
  dcaCount: {
    type: Number,
    default: 0
  },
  closeReason: {
    type: String,
    enum: ['TAKE_PROFIT', 'STOP_LOSS', 'TRAILING_STOP', 'MAX_DURATION', 'MANUAL', 'PNL_STAGNANT']
  }
});

module.exports = mongoose.model('Trade', tradeSchema);

// backend/services/BitgetAPI.js
const crypto = require('crypto');
const axios = require('axios');
const config = require('../config');

class BitgetAPI {
  constructor() {
    this.baseUrl = config.bitget.apiUrl;
    this.apiKey = config.bitget.apiKey;
    this.secretKey = config.bitget.secretKey;
    this.passphrase = config.bitget.passphrase;
    this.demo = config.bitget.demo;
  }

  // Генерация подписи для API запросов
  generateSignature(timestamp, method, requestPath, body = '') {
    const message = timestamp + method + requestPath + body;
    return crypto.createHmac('sha256', this.secretKey).update(message).digest('base64');
  }

  // Заголовки для API запросов
  getHeaders(method, requestPath, body = '') {
    const timestamp = Date.now().toString();
    const signature = this.generateSignature(timestamp, method, requestPath, body);
    
    return {
      'ACCESS-KEY': this.apiKey,
      'ACCESS-SIGN': signature,
      'ACCESS-TIMESTAMP': timestamp,
      'ACCESS-PASSPHRASE': this.passphrase,
      'Content-Type': 'application/json',
      'X-SIMULATED-TRADING': this.demo ? '1' : '0'
    };
  }

  // Выполнение API запроса
  async request(method, endpoint, params = {}, data = null) {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const headers = this.getHeaders(method, endpoint, data ? JSON.stringify(data) : '');
      
      const response = await axios({
        method,
        url,
        headers,
        params,
        data
      });
      
      return response.data;
    } catch (error) {
      console.error(`API Error: ${error.message}`);
      if (error.response) {
        console.error('Response Data:', error.response.data);
      }
      throw error;
    }
  }

  // Получение списка символов
  async getSymbols() {
    return this.request('GET', '/api/mix/v1/market/contracts', { productType: 'USDT-FUTURES' });
  }

  // Получение свечей (klines)
  async getKlines(symbol, interval = '1m', limit = 100) {
    return this.request('GET', '/api/mix/v1/market/candles', {
      symbol,
      granularity: interval,
      limit
    });
  }

  // Получение текущей цены (тикер)
  async getTicker(symbol) {
    return this.request('GET', '/api/mix/v1/market/ticker', { symbol });
  }

  // Получение баланса аккаунта
  async getAccountBalance() {
    return this.request('GET', '/api/mix/v1/account/accounts', { productType: 'USDT-FUTURES' });
  }

  // Получение открытых позиций
  async getPositions(symbol = '') {
    const params = { productType: 'USDT-FUTURES' };
    if (symbol) params.symbol = symbol;
    return this.request('GET', '/api/mix/v1/position/allPosition', params);
  }

  // Получение ордеров
  async getOrders(symbol, status = 'HISTORY', limit = 100) {
    return this.request('GET', '/api/mix/v1/order/history', {
      symbol,
      startTime: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 дней назад
      endTime: Date.now(),
      pageSize: limit
    });
  }

  // Размещение ордера
  async placeOrder(symbol, side, orderType, size, price = null, reduceOnly = false) {
    const data = {
      symbol,
      marginCoin: 'USDT',
      side,
      orderType,
      size: size.toString(),
      timeInForceValue: 'normal',
      reduceOnly
    };
    
    if (price) {
      data.price = price.toString();
    }
    
    return this.request('POST', '/api/mix/v1/order/placeOrder', {}, data);
  }

  // Отмена ордера
  async cancelOrder(symbol, orderId) {
    const data = {
      symbol,
      marginCoin: 'USDT',
      orderId
    };
    
    return this.request('POST', '/api/mix/v1/order/cancel-order', {}, data);
  }

  // Установка плеча
  async setLeverage(symbol, leverage, marginMode = 'crossed') {
    const data = {
      symbol,
      marginCoin: 'USDT',
      leverage: leverage.toString(),
      holdSide: 'long_short',
      marginMode
    };
    
    return this.request('POST', '/api/mix/v1/account/setLeverage', {}, data);
  }
}

module.exports = BitgetAPI;

// backend/services/Bot.js
const BitgetAPI = require('./BitgetAPI');
const Trade = require('../api/models/Trade');
const { v4: uuidv4 } = require('uuid');

class Bot {
  constructor(symbol, config) {
    this.symbol = symbol;
    this.config = config;
    this.api = new BitgetAPI();
    this.isActive = false;
    this.startTime = null;
    this.lastTick = null;
    this.interval = null;
    this.botId = uuidv4();
    this.openPosition = null;
    this.dcaOrders = [];
    this.stats = {
      totalTrades: 0,
      winTrades: 0,
      lossTrades: 0,
      totalPnl: 0,
      maxDrawdown: 0,
      currentBalance: config.initialBalance || 100,
      initialBalance: config.initialBalance || 100,
      tradesToday: 0,
      hourlyTrades: Array(24).fill(0),
      hourlyPnl: Array(24).fill(0)
    };
  }

  // Инициализация бота
  async initialize() {
    try {
      // Установка плеча
      await this.api.setLeverage(this.symbol, this.config.leverage);
      
      // Загрузка истории сделок из базы данных
      const trades = await Trade.find({ botId: this.botId, symbol: this.symbol }).sort({ entryTime: -1 });
      
      // Обновление статистики на основе истории
      this.updateStatsFromHistory(trades);
      
      console.log(`Bot initialized for ${this.symbol} with leverage ${this.config.leverage}x`);
    } catch (error) {
      console.error('Error initializing bot:', error);
      throw error;
    }
  }

  // Обновление статистики на основе истории сделок
  updateStatsFromHistory(trades) {
    this.stats.totalTrades = trades.length;
    this.stats.tradesToday = trades.filter(t => 
      new Date(t.entryTime) > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;
    
    let wins = 0;
    let losses = 0;
    let totalPnl = 0;
    let balance = this.config.initialBalance;
    let maxBalance = balance;
    let maxDrawdown = 0;
    
    // Обнуляем почасовую статистику
    this.stats.hourlyTrades = Array(24).fill(0);
    this.stats.hourlyPnl = Array(24).fill(0);
    
    // Анализируем закрытые сделки
    trades.filter(t => t.status === 'CLOSED').forEach(trade => {
      const pnl = trade.profitLoss || 0;
      totalPnl += pnl;
      
      if (pnl > 0) wins++;
      else if (pnl < 0) losses++;
      
      balance += pnl;
      
      if (balance > maxBalance) {
        maxBalance = balance;
      }
      
      const drawdown = (maxBalance - balance) / maxBalance * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
      
      // Обновляем почасовую статистику
      if (trade.exitTime) {
        const hour = new Date(trade.exitTime).getHours();
        this.stats.hourlyTrades[hour]++;
        this.stats.hourlyPnl[hour] += pnl;
      }
    });
    
    this.stats.winTrades = wins;
    this.stats.lossTrades = losses;
    this.stats.totalPnl = totalPnl;
    this.stats.maxDrawdown = maxDrawdown;
    this.stats.currentBalance = balance;
    
    // Проверка текущих открытых позиций
    const openTrade = trades.find(t => t.status === 'OPEN');
    if (openTrade) {
      this.openPosition = {
        trade: openTrade,
        entryPrice: openTrade.entryPrice,
        quantity: openTrade.quantity,
        direction: openTrade.direction,
        entryTime: openTrade.entryTime,
        dcaCount: openTrade.dcaCount,
        highestPrice: openTrade.direction === 'LONG' ? openTrade.entryPrice : Infinity,
        lowestPrice: openTrade.direction === 'SHORT' ? openTrade.entryPrice : 0,
        trailingStopPrice: this.calculateTrailingStopPrice(openTrade.entryPrice, openTrade.direction)
      };
    }
  }

  // Расчет цены трейлинг-стопа
  calculateTrailingStopPrice(price, direction) {
    return direction === 'LONG' 
      ? price * (1 - this.config.trailingStop / 100) 
      : price * (1 + this.config.trailingStop / 100);
  }

  // Запуск бота
  start() {
    if (this.isActive) return;
    
    this.isActive = true;
    this.startTime = Date.now();
    
    // Запуск тиков бота (проверка каждую минуту)
    this.interval = setInterval(() => this.tick(), 60000);
    
    // Запускаем первый тик сразу
    this.tick();
    
    console.log(`Bot started for ${this.symbol}`);
  }

  // Остановка бота
  async stop() {
    if (!this.isActive) return;
    
    this.isActive = false;
    clearInterval(this.interval);
    
    // Закрываем открытые позиции, если есть
    if (this.openPosition) {
      await this.closePosition('MANUAL');
    }
    
    console.log(`Bot stopped for ${this.symbol}`);
  }

  // Тик бота (выполняется каждую минуту)
  async tick() {
    try {
      if (!this.isActive) return;
      
      const now = Date.now();
      this.lastTick = now;
      
      // Получение текущей цены
      const ticker = await this.api.getTicker(this.symbol);
      const currentPrice = parseFloat(ticker.data.last);
      
      // Обработка открытых позиций
      if (this.openPosition) {
        await this.manageOpenPosition(currentPrice);
      } else {
        // Открытие новой позиции, если нет открытых
        await this.openNewPosition(currentPrice);
      }
    } catch (error) {
      console.error(`Error in bot tick for ${this.symbol}:`, error);
    }
  }

  // Управление открытой позицией
  async manageOpenPosition(currentPrice) {
    const position = this.openPosition;
    const elapsedMinutes = Math.floor((Date.now() - new Date(position.entryTime).getTime()) / 60000);
    
    // Обновление максимальной/минимальной цены и трейлинг-стопа
    if (position.direction === 'LONG') {
      if (currentPrice > position.highestPrice) {
        position.highestPrice = currentPrice;
        position.trailingStopPrice = this.calculateTrailingStopPrice(currentPrice, 'LONG');
      }
    } else { // SHORT
      if (currentPrice < position.lowestPrice) {
        position.lowestPrice = currentPrice;
        position.trailingStopPrice = this.calculateTrailingStopPrice(currentPrice, 'SHORT');
      }
    }
    
    // Расчет PnL
    let pnl = 0;
    if (position.direction === 'LONG') {
      pnl = position.quantity * (currentPrice - position.entryPrice);
    } else { // SHORT
      pnl = position.quantity * (position.entryPrice - currentPrice);
    }
    
    // Проверка условий для закрытия позиции
    const isTrailingStopTriggered = position.direction === 'LONG' 
      ? currentPrice < position.trailingStopPrice 
      : currentPrice > position.trailingStopPrice;
    
    const isMaxDurationReached = elapsedMinutes >= this.config.maxTradeDuration;
    
    // PnL не растет в течение некоторого времени
    let isPnlStagnant = false;
    // Здесь можно реализовать логику определения стагнации PnL
    
    if (isTrailingStopTriggered) {
      await this.closePosition('TRAILING_STOP', currentPrice, pnl);
    } else if (isMaxDurationReached) {
      await this.closePosition('MAX_DURATION', currentPrice, pnl);
    } else if (isPnlStagnant) {
      await this.closePosition('PNL_STAGNANT', currentPrice, pnl);
    } else {
      // Проверка необходимости DCA
      await this.checkAndPlaceDCAOrders(currentPrice);
    }
  }

  // Проверка и размещение DCA ордеров
  async checkAndPlaceDCAOrders(currentPrice) {
    if (!this.openPosition || this.openPosition.dcaCount >= this.config.maxDCAOrders) {
      return;
    }
    
    const position = this.openPosition;
    
    // Проверка условий для DCA
    if (position.direction === 'LONG' && currentPrice < position.entryPrice * (1 - this.config.dcaPriceStep / 100)) {
      await this.placeDCAOrder(currentPrice);
    } else if (position.direction === 'SHORT' && currentPrice > position.entryPrice * (1 + this.config.dcaPriceStep / 100)) {
      await this.placeDCAOrder(currentPrice);
    }
  }

  // Размещение DCA ордера
  async placeDCAOrder(currentPrice) {
    try {
      const position = this.openPosition;
      const dcaSize = position.trade.quantity * Math.pow(this.config.dcaMultiplier, position.dcaCount);
      
      // Размещение ордера
      const order = await this.api.placeOrder(
        this.symbol,
        position.direction === 'LONG' ? 'buy' : 'sell',
        'market',
        dcaSize
      );
      
      // Обновление позиции
      position.dcaCount++;
      
      // Расчет новой средней цены входа
      const totalValue = position.entryPrice * position.quantity;
      const newValue = currentPrice * dcaSize;
      const newQuantity = position.quantity + dcaSize;
      position.entryPrice = (totalValue + newValue) / newQuantity;
      position.quantity = newQuantity;
      
      // Обновление трейлинг-стопа
      position.trailingStopPrice = this.calculateTrailingStopPrice(position.entryPrice, position.direction);
      
      // Обновление записи в базе данных
      await Trade.updateOne(
        { _id: position.trade._id },
        { 
          entryPrice: position.entryPrice,
          quantity: position.quantity,
          dcaCount: position.dcaCount
        }
      );
      
      console.log(`DCA order placed for ${this.symbol} at price ${currentPrice}, new entry price: ${position.entryPrice}`);
    } catch (error) {
      console.error(`Error placing DCA order for ${this.symbol}:`, error);
    }
  }

  // Открытие новой позиции
  async openNewPosition(currentPrice) {
    try {
      // Случайный выбор направления (в реальной стратегии здесь будет анализ рынка)
      const direction = Math.random() > 0.5 ? 'LONG' : 'SHORT';
      
      // Размер позиции с учетом плеча
      const positionSize = this.stats.currentBalance * this.config.leverage / currentPrice;
      
      // Размещение ордера
      const order = await this.api.placeOrder(
        this.symbol,
        direction === 'LONG' ? 'buy' : 'sell',
        'market',
        positionSize
      );
      
      // Создание записи о сделке
      const trade = new Trade({
        symbol: this.symbol,
        botId: this.botId,
        direction,
        entryPrice: currentPrice,
        quantity: positionSize,
        entryTime: new Date(),
        status: 'OPEN',
        dcaCount: 0
      });
      
      await trade.save();
      
      // Обновление данных позиции
      this.openPosition = {
        trade,
        entryPrice: currentPrice,
        quantity: positionSize,
        direction,
        entryTime: new Date(),
        dcaCount: 0,
        highestPrice: direction === 'LONG' ? currentPrice : Infinity,
        lowestPrice: direction === 'SHORT' ? currentPrice : 0,
        trailingStopPrice: this.calculateTrailingStopPrice(currentPrice, direction)
      };
      
      console.log(`New position opened for ${this.symbol}: ${direction} at price ${currentPrice}`);
    } catch (error) {
      console.error(`Error opening new position for ${this.symbol}:`, error);
    }
  }

  // Закрытие позиции
  async closePosition(reason, exitPrice = null, pnl = null) {
    try {
      if (!this.openPosition) return;
      
      const position = this.openPosition;
      
      // Если цена закрытия не предоставлена, получаем текущую
      if (!exitPrice) {
        const ticker = await this.api.getTicker(this.symbol);
        exitPrice = parseFloat(ticker.data.last);
      }
      
      // Если PnL не предоставлен, рассчитываем
      if (pnl === null) {
        if (position.direction === 'LONG') {
          pnl = position.quantity * (exitPrice - position.entryPrice);
        } else { // SHORT
          pnl = position.quantity * (position.entryPrice - exitPrice);
        }
      }
      
      // Размещение ордера на закрытие позиции
      const order = await this.api.placeOrder(
        this.symbol,
        position.direction === 'LONG' ? 'sell' : 'buy',
        'market',
        position.quantity,
        null,
        true // reduceOnly
      );
      
      // Обновление записи в базе данных
      await Trade.updateOne(
        { _id: position.trade._id },
        { 
          status: 'CLOSED',
          exitPrice,
          exitTime: new Date(),
          profitLoss: pnl,
          closeReason: reason
        }
      );
      
      // Обновление статистики
      this.stats.totalTrades++;
      this.stats.tradesToday++;
      
      if (pnl > 0) {
        this.stats.winTrades++;
      } else {
        this.stats.lossTrades++;
      }
      
      this.stats.totalPnl += pnl;
      this.stats.currentBalance += pnl;
      
      // Реинвестирование прибыли
      if (pnl > 0 && this.config.reinvestment > 0) {
        const reinvestAmount = pnl * (this.config.reinvestment / 100);
        this.stats.currentBalance += reinvestAmount;
      }
      
      // Обновление почасовой статистики
      const hour = new Date().getHours();
      this.stats.hourlyTrades[hour]++;
      this.stats.hourlyPnl[hour] += pnl;
      
      // Сброс открытой позиции
      this.openPosition = null;
      
      console.log(`Position closed for ${this.symbol} at price ${exitPrice}, PnL: ${pnl}, reason: ${reason}`);
    } catch (error) {
      console.error(`Error closing position for ${this.symbol}:`, error);
    }
  }

  // Обновление конфигурации
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  // Проверка статуса бота
  isRunning() {
    return this.isActive;
  }

  // Получение времени работы бота
  getUptime() {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime;
  }

  // Получение статистики
  getStats() {
    return {
      ...this.stats,
      winRate: this.stats.totalTrades > 0 
        ? (this.stats.winTrades / this.stats.totalTrades) * 100 
        : 0,
      returnPercentage: ((this.stats.currentBalance - this.stats.initialBalance) / this.stats.initialBalance) * 100,
      openPosition: this.openPosition ? {
        direction: this.openPosition.direction,
        entryPrice: this.openPosition.entryPrice,
        currentPrice: null, // Заполняется при вызове
        pnl: null, // Заполняется при вызове
        duration: Math.floor((Date.now() - new Date(this.openPosition.entryTime).getTime()) / 60000)
      } : null
    };
  }
}

module.exports = Bot;

////////////////////////////////////////////////////////////
// FRONTEND
////////////////////////////////////////////////////////////

// frontend/src/App.js
import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import BotConfig from './pages/BotConfig';
import TradingView from './pages/TradingView';
import TradeHistory from './pages/TradeHistory';
import Settings from './pages/Settings';
import Box from '@mui/material/Box';

// Темная тема для приложения
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Router>
        <Box sx={{ display: 'flex' }}>
          <Header />
          <Sidebar />
          <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8, ml: { sm: 30 } }}>
            <Switch>
              <Route exact path="/" component={Dashboard} />
              <Route path="/config" component={BotConfig} />
              <Route path="/trading" component={TradingView} />
              <Route path="/history" component={TradeHistory} />
              <Route path="/settings" component={Settings} />
            </Switch>
          </Box>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;

// frontend/src/components/Header.js
import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AccountCircle from '@mui/icons-material/AccountCircle';
import MenuIcon from '@mui/icons-material/Menu';
import Box from '@mui/material/Box';
import useAccountBalance from '../hooks/useAccountBalance';

const Header = () => {
  const { balance, loading } = useAccountBalance();

  return (
    <AppBar position="fixed" color="primary" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar>
        <IconButton
          edge="start"
          color="inherit"
          aria-label="menu"
          sx={{ mr: 2, display: { sm: 'none' } }}
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
          BitGet Trading Bot
        </Typography>
        
        {!loading && balance && (
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
            <Typography variant="body1" sx={{ mr: 1 }}>
              Balance:
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
              {parseFloat(balance.data?.totalAvailableMargin).toFixed(2)} USDT
            </Typography>
          </Box>
        )}
        
        <IconButton color="inherit">
          <Badge badgeContent={4} color="secondary">
            <NotificationsIcon />
          </Badge>
        </IconButton>
        <IconButton
          edge="end"
          aria-label="account"
          aria-haspopup="true"
          color="inherit"
        >
          <AccountCircle />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
};

export default Header;

// frontend/src/components/Sidebar.js
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SettingsIcon from '@mui/icons-material/Settings';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import HistoryIcon from '@mui/icons-material/History';
import BuildIcon from '@mui/icons-material/Build';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

const drawerWidth = 240;

const Sidebar = () => {
  const location = useLocation();

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    { text: 'Bot Configuration', icon: <BuildIcon />, path: '/config' },
    { text: 'Trading View', icon: <ShowChartIcon />, path: '/trading' },
    { text: 'Trade History', icon: <HistoryIcon />, path: '/history' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box', mt: 8 },
        display: { xs: 'none', sm: 'block' },
      }}
    >
      <Box sx={{ overflow: 'auto' }}>
        <List>
          {menuItems.map((item) => (
            <ListItem 
              button 
              key={item.text} 
              component={Link} 
              to={item.path}
              selected={location.pathname === item.path}
              sx={{ 
                '&.Mui-selected': {
                  backgroundColor: 'rgba(144, 202, 249, 0.2)',
                },
                '&.Mui-selected:hover': {
                  backgroundColor: 'rgba(144, 202, 249, 0.3)',
                }
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItem>
          ))}
        </List>
        <Divider />
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" color="textSecondary">
            Simulation Mode: Active
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
};

export default Sidebar;

// frontend/src/components/BotCard.js
import React, { useState } from 'react';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Grid from '@mui/material/Grid';
import CircularProgress from '@mui/material/CircularProgress';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import Chip from '@mui/material/Chip';
import useBotStatus from '../hooks/useBotStatus';
import { startBot, stopBot } from '../services/botService';

const BotCard = ({ symbol, config }) => {
  const { status, loading, error, refetch } = useBotStatus(symbol);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  const handleStart = async () => {
    setIsStarting(true);
    try {
      await startBot(symbol, config);
      await refetch();
    } catch (error) {
      console.error(`Error starting bot for ${symbol}:`, error);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = async () => {
    setIsStopping(true);
    try {
      await stopBot(symbol);
      await refetch();
    } catch (error) {
      console.error(`Error stopping bot for ${symbol}:`, error);
    } finally {
      setIsStopping(false);
    }
  };

  if (loading) {
    return (
      <Card sx={{ minWidth: 275, height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress />
      </Card>
    );
  }

  const isRunning = status?.running;
  const uptime = status?.uptime ? Math.floor(status.uptime / (1000 * 60 * 60)) : 0; // в часах
  const stats = status?.stats || {};

  return (
    <Card sx={{ minWidth: 275, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardHeader
        title={symbol}
        subheader={
          <Chip 
            label={isRunning ? "Running" : "Stopped"} 
            color={isRunning ? "success" : "error"} 
            size="small" 
            sx={{ mt: 1 }}
          />
        }
        action={
          <Switch
            checked={isRunning}
            onChange={isRunning ? handleStop : handleStart}
            disabled={isStarting || isStopping}
          />
        }
      />
      <CardContent sx={{ flexGrow: 1 }}>
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="subtitle2" color="textSecondary">Balance</Typography>
            <Typography variant="h6">{stats.currentBalance?.toFixed(2)} USDT</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="subtitle2" color="textSecondary">P&L</Typography>
            <Typography 
              variant="h6" 
              color={stats.totalPnl > 0 ? 'success.main' : 'error.main'}
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              {stats.totalPnl?.toFixed(2)} USDT
              {stats.totalPnl > 0 ? <TrendingUpIcon sx={{ ml: 1 }} /> : <TrendingDownIcon sx={{ ml: 1 }} />}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="subtitle2" color="textSecondary">Win Rate</Typography>
            <Typography variant="h6">{stats.winRate?.toFixed(2)}%</Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="subtitle2" color="textSecondary">Total Trades</Typography>
            <Typography variant="h6">{stats.totalTrades || 0}</Typography>
          </Grid>
          {isRunning && (
            <>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="textSecondary">Uptime</Typography>
                <Typography variant="body2">{uptime} hours</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="textSecondary">Today's Trades</Typography>
                <Typography variant="body2">{stats.tradesToday || 0}</Typography>
              </Grid>
            </>
          )}
        </Grid>
      </CardContent>
      <CardActions>
        <Button 
          size="small" 
          startIcon={isRunning ? <StopIcon /> : <PlayArrowIcon />}
          color={isRunning ? "error" : "success"}
          onClick={isRunning ? handleStop : handleStart}
          disabled={isStarting || isStopping}
        >
          {isRunning ? "Stop" : "Start"}
        </Button>
        <Button size="small" color="primary">
          Details
        </Button>
      </CardActions>
    </Card>
  );
};

export default BotCard;

// frontend/src/components/ChartComponent.js
import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';
import Box from '@mui/material/Box';
import useKlines from '../hooks/useKlines';
import { formatCandlestickData } from '../utils/dataFormatters';

const ChartComponent = ({ symbol, interval = '1m', height = 400 }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const { klines, loading, error } = useKlines(symbol, interval);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Создание графика
    chartRef.current = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { color: '#1E1E1E' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: {
          color: 'rgba(42, 46, 57, 0.5)',
        },
        horzLines: {
          color: 'rgba(42, 46, 57, 0.5)',
        },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Обработчик изменения размера окна
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({ 
          width: chartContainerRef.current.clientWidth 
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [height]);

  useEffect(() => {
    if (!chartRef.current || !klines || loading) return;

    // Форматирование данных для графика
    const candlestickData = formatCandlestickData(klines);

    // Создание серии свечей
    const candlestickSeries = chartRef.current.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    // Установка данных
    candlestickSeries.setData(candlestickData);

    // Настройка временной шкалы
    chartRef.current.timeScale().fitContent();

    return () => {
      chartRef.current.removeSeries(candlestickSeries);
    };
  }, [klines, loading, interval]);

  if (error) {
    return <div>Error loading chart data: {error.message}</div>;
  }

  return (
    <Box
      ref={chartContainerRef}
      sx={{
        width: '100%',
        height: `${height}px`,
        display: loading ? 'flex' : 'block',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {loading && 'Loading chart...'}
    </Box>
  );
};

export default ChartComponent;

// frontend/src/components/ConfigForm.js
import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { getBotConfig, updateBotConfig } from '../services/botService';
import { Slider } from '@mui/material';

const ConfigForm = ({ symbol, onConfigChange }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { control, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: {
      timeframe: '1m',
      leverage: 10,
      initialBalance: 100,
      trailingStop: 0.5,
      maxDCAOrders: 5,
      dcaPriceStep: 1.5,
      dcaMultiplier: 1.5,
      maxTradeDuration: 5,
      reinvestment: 100,
      enabled: true
    }
  });

  // Загрузка конфигурации при монтировании
  useEffect(() => {
    const loadConfig = async () => {
      if (!symbol) return;
      
      setLoading(true);
      try {
        const config = await getBotConfig(symbol);
        if (config) {
          // Установка значений формы
          Object.entries(config).forEach(([key, value]) => {
            setValue(key, value);
          });
        }
      } catch (error) {
        console.error('Error loading bot config:', error);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [symbol, setValue]);

  const onSubmit = async (data) => {
    if (!symbol) return;
    
    setSaving(true);
    try {
      await updateBotConfig(symbol, data);
      if (onConfigChange) {
        onConfigChange(data);
      }
    } catch (error) {
      console.error('Error saving bot config:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    reset();
  };

  const currentLeverage = watch('leverage');
  const currentReinvestment = watch('reinvestment');

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2" gutterBottom>
          Bot Configuration for {symbol}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Controller
                name="timeframe"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Timeframe</InputLabel>
                    <Select {...field} label="Timeframe">
                      <MenuItem value="1m">1 Minute</MenuItem>
                      <MenuItem value="3m">3 Minutes</MenuItem>
                      <MenuItem value="5m">5 Minutes</MenuItem>
                      <MenuItem value="15m">15 Minutes</MenuItem>
                      <MenuItem value="30m">30 Minutes</MenuItem>
                      <MenuItem value="1h">1 Hour</MenuItem>
                      <MenuItem value="4h">4 Hours</MenuItem>
                      <MenuItem value="1d">1 Day</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Controller
                name="initialBalance"
                control={control}
                rules={{ required: true, min: 1 }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Initial Balance (USDT)"
                    variant="outlined"
                    type="number"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error ? 'Required, minimum 1 USDT' : ''}
                    InputProps={{
                      endAdornment: <Typography variant="body2">USDT</Typography>,
                    }}
                  />
                )}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>
                Leverage: {currentLeverage}x
              </Typography>
              <Controller
                name="leverage"
                control={control}
                render={({ field }) => (
                  <Slider
                    {...field}
                    min={1}
                    max={100}
                    step={1}
                    valueLabelDisplay="auto"
                    marks={[
                      { value: 1, label: '1x' },
                      { value: 20, label: '20x' },
                      { value: 50, label: '50x' },
                      { value: 100, label: '100x' },
                    ]}
                  />
                )}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <Controller
                name="trailingStop"
                control={control}
                rules={{ required: true, min: 0.1 }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Trailing Stop (%)"
                    variant="outlined"
                    type="number"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error ? 'Required, minimum 0.1%' : ''}
                    InputProps={{
                      endAdornment: <Typography variant="body2">%</Typography>,
                    }}
                  />
                )}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                DCA Settings
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <Controller
                name="maxDCAOrders"
                control={control}
                rules={{ required: true, min: 0, max: 10 }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Max DCA Orders"
                    variant="outlined"
                    type="number"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error ? 'Required, 0-10' : ''}
                  />
                )}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <Controller
                name="dcaPriceStep"
                control={control}
                rules={{ required: true, min: 0.1 }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="DCA Price Step (%)"
                    variant="outlined"
                    type="number"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error ? 'Required, minimum 0.1%' : ''}
                    InputProps={{
                      endAdornment: <Typography variant="body2">%</Typography>,
                    }}
                  />
                )}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <Controller
                name="dcaMultiplier"
                control={control}
                rules={{ required: true, min: 1 }}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="DCA Size Multiplier"
                    variant="outlined"
                    type="number"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error ? 'Required, minimum 1' : ''}
                    InputProps={{
                      endAdornment: <Typography variant="body2">x</Typography>,
                    }}
                  />
                )}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Trade Settings
              </Typography>
              <Divider sx={{ mb: 2 }} />
            </Grid>
            
            
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>
                Reinvestment: {currentReinvestment}%
              </Typography>
              <Controller
                name="reinvestment"
                control={control}
                render={({ field }) => (
                  <Slider
                    {...field}
                    min={0}
                    max={100}
                    step={10}
                    valueLabelDisplay="auto"
                    marks={[
                      { value: 0, label: '0%' },
                      { value: 50, label: '50%' },
                      { value: 100, label: '100%' },
                    ]}
                  />
                )}
              />
            </Grid>
            
            <Grid item xs={12}>
              <Controller
                name="enabled"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch checked={field.value} onChange={field.onChange} />}
                    label="Enable Bot"
                  />
                )}
              />
            </Grid>
          </Grid>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
            <Button 
              variant="outlined" 
              onClick={handleReset}
              disabled={loading || saving}
            >
              Reset
            </Button>
            <Button 
              type="submit" 
              variant="contained" 
              color="primary"
              disabled={loading || saving}
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
          </Box>
        </form>
      </CardContent>
    </Card>
  );
};

export default ConfigForm;

// frontend/src/components/TradeHistoryTable.js
import React, { useState } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import Box from '@mui/material/Box';
import { formatDate, formatCurrency } from '../utils/formatters';

const TradeHistoryTable = ({ trades = [], loading }) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Определение цвета для PnL
  const getPnLColor = (pnl) => {
    if (pnl > 0) return 'success.main';
    if (pnl < 0) return 'error.main';
    return 'text.primary';
  };

  // Определение статуса сделки
  const getStatusChip = (status) => {
    switch (status) {
      case 'OPEN':
        return <Chip label="Open" color="primary" size="small" />;
      case 'CLOSED':
        return <Chip label="Closed" color="default" size="small" />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  // Определение иконки для направления сделки
  const getDirectionIcon = (direction) => {
    return direction === 'LONG' ? 
      <ArrowUpwardIcon color="success" fontSize="small" /> : 
      <ArrowDownwardIcon color="error" fontSize="small" />;
  };

  // Определение метки для причины закрытия
  const getCloseReasonLabel = (reason) => {
    switch (reason) {
      case 'TAKE_PROFIT':
        return 'Take Profit';
      case 'STOP_LOSS':
        return 'Stop Loss';
      case 'TRAILING_STOP':
        return 'Trailing Stop';
      case 'MAX_DURATION':
        return 'Max Duration';
      case 'MANUAL':
        return 'Manual';
      case 'PNL_STAGNANT':
        return 'PnL Stagnant';
      default:
        return reason || '-';
    }
  };

  // Пустое состояние
  if (trades.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" color="textSecondary">
          {loading ? 'Loading trade history...' : 'No trades found.'}
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Symbol</TableCell>
              <TableCell>Direction</TableCell>
              <TableCell>Entry Time</TableCell>
              <TableCell>Exit Time</TableCell>
              <TableCell>Entry Price</TableCell>
              <TableCell>Exit Price</TableCell>
              <TableCell>Quantity</TableCell>
              <TableCell>PnL</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>DCA Count</TableCell>
              <TableCell>Close Reason</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {trades
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((trade) => (
                <TableRow key={trade._id} hover>
                  <TableCell>{trade.symbol}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {getDirectionIcon(trade.direction)}
                      {trade.direction}
                    </Box>
                  </TableCell>
                  <TableCell>{formatDate(trade.entryTime)}</TableCell>
                  <TableCell>{trade.exitTime ? formatDate(trade.exitTime) : '-'}</TableCell>
                  <TableCell>{formatCurrency(trade.entryPrice)}</TableCell>
                  <TableCell>{trade.exitPrice ? formatCurrency(trade.exitPrice) : '-'}</TableCell>
                  <TableCell>{trade.quantity.toFixed(6)}</TableCell>
                  <TableCell>
                    <Typography color={getPnLColor(trade.profitLoss)}>
                      {trade.profitLoss ? formatCurrency(trade.profitLoss) : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>{getStatusChip(trade.status)}</TableCell>
                  <TableCell>{trade.dcaCount}</TableCell>
                  <TableCell>{getCloseReasonLabel(trade.closeReason)}</TableCell>
                </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[5, 10, 25, 50]}
        component="div"
        count={trades.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
  );
};

export default TradeHistoryTable;

// frontend/src/components/StatsCard.js
import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import { TrendingUp, TrendingDown, ShowChart, AccountBalance } from '@mui/icons-material';
import { formatCurrency, formatPercentage } from '../utils/formatters';

const StatItem = ({ title, value, icon, color }) => {
  return (
    <Grid item xs={6} sm={3}>
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Grid container spacing={1} alignItems="center">
            <Grid item>{React.cloneElement(icon, { color })}</Grid>
            <Grid item>
              <Typography variant="subtitle2" color="textSecondary">
                {title}
              </Typography>
            </Grid>
          </Grid>
          <Typography variant="h5" component="div" sx={{ mt: 1, color: `${color}.main` }}>
            {value}
          </Typography>
        </CardContent>
      </Card>
    </Grid>
  );
};

const StatsCard = ({ stats }) => {
  if (!stats) {
    return null;
  }

  const {
    currentBalance,
    initialBalance,
    totalPnl,
    winRate,
    totalTrades,
    maxDrawdown,
    returnPercentage
  } = stats;

  const pnlColor = totalPnl >= 0 ? 'success' : 'error';
  const returnsColor = returnPercentage >= 0 ? 'success' : 'error';

  return (
    <Grid container spacing={2}>
      <StatItem
        title="Current Balance"
        value={formatCurrency(currentBalance)}
        icon={<AccountBalance />}
        color="primary"
      />
      <StatItem
        title="Total PnL"
        value={formatCurrency(totalPnl)}
        icon={totalPnl >= 0 ? <TrendingUp /> : <TrendingDown />}
        color={pnlColor}
      />
      <StatItem
        title="Return"
        value={formatPercentage(returnPercentage)}
        icon={<ShowChart />}
        color={returnsColor}
      />
      <StatItem
        title="Win Rate"
        value={formatPercentage(winRate)}
        icon={<ShowChart />}
        color="info"
      />
      <StatItem
        title="Total Trades"
        value={totalTrades}
        icon={<ShowChart />}
        color="secondary"
      />
      <StatItem
        title="Max Drawdown"
        value={formatPercentage(maxDrawdown)}
        icon={<TrendingDown />}
        color="warning"
      />
      <StatItem
        title="Initial Balance"
        value={formatCurrency(initialBalance)}
        icon={<AccountBalance />}
        color="default"
      />
      <StatItem
        title="Today's Trades"
        value={stats.tradesToday || 0}
        icon={<ShowChart />}
        color="secondary"
      />
    </Grid>
  );
};

export default StatsCard;

// frontend/src/components/PerfomanceChart.js
import React, { useEffect, useRef } from 'react';
import { Chart } from 'chart.js/auto';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Box from '@mui/material/Box';

const PerformanceChart = ({ hourlyPnl, hourlyTrades }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!hourlyPnl || !hourlyTrades || !chartRef.current) return;

    // Уничтожаем предыдущий экземпляр графика, если существует
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Данные для графика
    const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    
    const data = {
      labels,
      datasets: [
        {
          type: 'line',
          label: 'PnL (USDT)',
          data: hourlyPnl,
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          yAxisID: 'y',
        },
        {
          type: 'bar',
          label: 'Trades',
          data: hourlyTrades,
          borderColor: 'rgb(54, 162, 235)',
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          yAxisID: 'y1',
        }
      ]
    };

    // Конфигурация графика
    const config = {
      data,
      options: {
        responsive: true,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'PnL (USDT)'
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: {
              drawOnChartArea: false,
            },
            title: {
              display: true,
              text: 'Number of Trades'
            }
          },
        }
      },
    };

    // Создание нового экземпляра графика
    chartInstance.current = new Chart(chartRef.current, config);

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [hourlyPnl, hourlyTrades]);

  return (
    <Card>
      <CardHeader title="Hourly Performance" />
      <CardContent>
        <Box sx={{ height: 300 }}>
          <canvas ref={chartRef} />
        </Box>
      </CardContent>
    </Card>
  );
};

export default PerformanceChart;

// frontend/src/pages/Dashboard.js
import React, { useState, useEffect } from 'react';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import BotCard from '../components/BotCard';
import StatsCard from '../components/StatsCard';
import PerformanceChart from '../components/PerfomanceChart';
import useSymbols from '../hooks/useSymbols';
import useBotStatus from '../hooks/useBotStatus';
import { getBotConfig } from '../services/botService';

const Dashboard = () => {
  const { symbols, loading: loadingSymbols } = useSymbols();
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [configs, setConfigs] = useState({});
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const { status, loading: loadingStatus } = useBotStatus(selectedSymbol);

  // Загрузка конфигураций ботов
  useEffect(() => {
    const loadConfigs = async () => {
      if (!symbols || symbols.length === 0) return;
      
      setLoadingConfigs(true);
      
      const newConfigs = {};
      for (const symbol of symbols.slice(0, 5)) { // Ограничиваем 5 первыми символами для демонстрации
        try {
          const config = await getBotConfig(symbol);
          if (config) {
            newConfigs[symbol] = config;
          }
        } catch (error) {
          console.error(`Error loading config for ${symbol}:`, error);
        }
      }
      
      setConfigs(newConfigs);
      
      // Устанавливаем первый символ как выбранный, если не был выбран
      if (!selectedSymbol && symbols.length > 0) {
        setSelectedSymbol(symbols[0]);
      }
      
      setLoadingConfigs(false);
    };

    loadConfigs();
  }, [symbols]);

  const handleSymbolChange = (event) => {
    setSelectedSymbol(event.target.value);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      
      <Box sx={{ mb: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Active Bots
              </Typography>
              {loadingSymbols || loadingConfigs ? (
                <Typography>Loading bots...</Typography>
              ) : Object.keys(configs).length === 0 ? (
                <Alert severity="info">
                  No configured bots found. Go to Bot Configuration to set up your first bot.
                </Alert>
              ) : (
                <Grid container spacing={2}>
                  {Object.keys(configs).map((symbol) => (
                    <Grid item xs={12} sm={6} md={4} key={symbol}>
                      <BotCard 
                        symbol={symbol} 
                        config={configs[symbol]} 
                      />
                    </Grid>
                  ))}
                </Grid>
              )}
            </Paper>
          </Grid>
          
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Account Summary
              </Typography>
              <Typography variant="body1">
                Total Bots: {Object.keys(configs).length}
              </Typography>
              <Typography variant="body1">
                Active Bots: {Object.keys(status || {}).filter(key => status[key]?.running).length}
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="h6" gutterBottom>
                Select Bot for Detailed Stats
              </Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Symbol</InputLabel>
                <Select
                  value={selectedSymbol}
                  onChange={handleSymbolChange}
                  label="Symbol"
                  disabled={loadingSymbols || loadingConfigs}
                >
                  {symbols?.map((symbol) => (
                    <MenuItem key={symbol} value={symbol}>{symbol}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Paper>
          </Grid>
        </Grid>
      </Box>
      
      {selectedSymbol && status && !loadingStatus && (
        <>
          <Typography variant="h5" gutterBottom>
            {selectedSymbol} Bot Performance
          </Typography>
          
          <Box sx={{ mb: 4 }}>
            <StatsCard stats={status.stats} />
          </Box>
          
          <Box sx={{ mb: 4 }}>
            <PerformanceChart
              hourlyPnl={status.stats?.hourlyPnl}
              hourlyTrades={status.stats?.hourlyTrades}
            />
          </Box>
        </>
      )}
    </Box>
  );
};

export default Dashboard;

// frontend/src/pages/BotConfig.js
import React, { useState, useEffect } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import ConfigForm from '../components/ConfigForm';
import useSymbols from '../hooks/useSymbols';

const BotConfig = () => {
  const { symbols, loading: loadingSymbols } = useSymbols();
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (symbols?.length > 0 && !selectedSymbol) {
      setSelectedSymbol(symbols[0]);
    }
  }, [symbols]);

  const handleSymbolChange = (event) => {
    setSelectedSymbol(event.target.value);
    setShowForm(false);
  };

  const handleConfigureClick = () => {
    setShowForm(true);
  };

  const handleConfigChange = (config) => {
    // Обработка изменения конфигурации (можно добавить дополнительную логику)
    console.log(`Configuration updated for ${selectedSymbol}:`, config);
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Bot Configuration
      </Typography>
      
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Symbol</InputLabel>
          <Select
            value={selectedSymbol}
            onChange={handleSymbolChange}
            label="Symbol"
            disabled={loadingSymbols}
          >
            {symbols?.map((symbol) => (
              <MenuItem key={symbol} value={symbol}>{symbol}</MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <Button 
          variant="contained" 
          onClick={handleConfigureClick}
          disabled={!selectedSymbol}
        >
          Configure Bot
        </Button>
      </Box>
      
      {!loadingSymbols && !symbols?.length && (
        <Alert severity="warning">
          Unable to load trading symbols. Please check your connection to BitGet API.
        </Alert>
      )}
      
      {showForm && selectedSymbol && (
        <ConfigForm 
          symbol={selectedSymbol} 
          onConfigChange={handleConfigChange} 
        />
      )}
    </Box>
  );
};

export default BotConfig;

// frontend/src/pages/TradingView.js
import React, { useState, useEffect } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import ChartComponent from '../components/ChartComponent';
import useSymbols from '../hooks/useSymbols';
import useTicker from '../hooks/useTicker';

const TimeframeSelector = ({ value, onChange }) => {
  const timeframes = [
    { value: '1m', label: '1 Minute' },
    { value: '3m', label: '3 Minutes' },
    { value: '5m', label: '5 Minutes' },
    { value: '15m', label: '15 Minutes' },
    { value: '30m', label: '30 Minutes' },
    { value: '1h', label: '1 Hour' },
    { value: '4h', label: '4 Hours' },
    { value: '1d', label: '1 Day' }
  ];
  
  return (
    <FormControl sx={{ minWidth: 120 }}>
      <InputLabel>Timeframe</InputLabel>
      <Select
        value={value}
        onChange={onChange}
        label="Timeframe"
      >
        {timeframes.map((tf) => (
          <MenuItem key={tf.value} value={tf.value}>{tf.label}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

const TradingView = () => {
  const { symbols, loading: loadingSymbols } = useSymbols();
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [timeframe, setTimeframe] = useState('1m');
  const { ticker, loading: loadingTicker } = useTicker(selectedSymbol);

  useEffect(() => {
    if (symbols?.length > 0 && !selectedSymbol) {
      setSelectedSymbol(symbols[0]);
    }
  }, [symbols]);

  const handleSymbolChange = (event) => {
    setSelectedSymbol(event.target.value);
  };

  const handleTimeframeChange = (event) => {
    setTimeframe(event.target.value);
  };

  // Форматирование цены
  const formatPrice = (price) => {
    return parseFloat(price).toFixed(2);
  };

  // Расчет изменения в процентах
  const calculateChange = (last, open) => {
    if (!last || !open) return 0;
    return ((last - open) / open) * 100;
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Trading View
      </Typography>
      
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Symbol</InputLabel>
            <Select
              value={selectedSymbol}
              onChange={handleSymbolChange}
              label="Symbol"
              disabled={loadingSymbols}
            >
              {symbols?.map((symbol) => (
                <MenuItem key={symbol} value={symbol}>{symbol}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        
        <Grid item>
          <TimeframeSelector value={timeframe} onChange={handleTimeframeChange} />
        </Grid>
      </Grid>
      
      {selectedSymbol && (
        <Grid container spacing={3}>
          <Grid item xs={12} lg={9}>
            <Paper sx={{ p: 2, height: '600px' }}>
              <ChartComponent 
                symbol={selectedSymbol} 
                interval={timeframe}
                height={560}
              />
            </Paper>
          </Grid>
          
          <Grid item xs={12} lg={3}>
            <Paper sx={{ p: 2, height: '600px', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" gutterBottom>
                Market Info
              </Typography>
              
              {loadingTicker ? (
                <Typography>Loading market data...</Typography>
              ) : ticker ? (
                <Box>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="textSecondary">Last Price</Typography>
                      <Typography variant="h5">{formatPrice(ticker.data?.last)}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="textSecondary">24h Change</Typography>
                      <Typography 
                        variant="h5" 
                        color={calculateChange(ticker.data?.last, ticker.data?.open24h) >= 0 ? 'success.main' : 'error.main'}
                      >
                        {calculateChange(ticker.data?.last, ticker.data?.open24h).toFixed(2)}%
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="textSecondary">24h High</Typography>
                      <Typography variant="body1">{formatPrice(ticker.data?.high24h)}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="textSecondary">24h Low</Typography>
                      <Typography variant="body1">{formatPrice(ticker.data?.low24h)}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="textSecondary">24h Volume</Typography>
                      <Typography variant="body1">{parseFloat(ticker.data?.volume24h).toFixed(2)}</Typography>
                    </Grid>
                    <Grid item xs={12} sx={{ mt: 2 }}>
                      <Button 
                        variant="contained" 
                        color="success"

                        fullWidth
                        sx={{ mb: 1 }}
                      >
                        Buy / Long
                      </Button>
                      <Button 
                        variant="contained" 
                        color="error"
                        fullWidth
                      >
                        Sell / Short
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              ) : (
                <Typography>No market data available.</Typography>
              )}
              
              <Box sx={{ flexGrow: 1 }} />
              
              <Box sx={{ mt: 4 }}>
                <Typography variant="h6" gutterBottom>
                  Quick Bot Actions
                </Typography>
                <Button 
                  variant="outlined" 
                  color="primary"
                  fullWidth
                  sx={{ mb: 1 }}
                >
                  Start Bot for {selectedSymbol}
                </Button>
                <Button 
                  variant="outlined" 
                  color="error"
                  fullWidth
                >
                  Stop All Bots
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default TradingView;

// frontend/src/pages/TradeHistory.js
import React, { useState, useEffect } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import TradeHistoryTable from '../components/TradeHistoryTable';
import useSymbols from '../hooks/useSymbols';
import { getTrades } from '../services/tradeService';

const TradeHistory = () => {
  const { symbols, loading: loadingSymbols } = useSymbols();
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    dateFrom: '',
    dateTo: '',
  });

  useEffect(() => {
    if (symbols?.length > 0 && !selectedSymbol) {
      setSelectedSymbol('all');
    }
  }, [symbols]);

  useEffect(() => {
    loadTrades();
  }, [selectedSymbol]);

  const loadTrades = async () => {
    setLoading(true);
    try {
      const response = await getTrades({
        symbol: selectedSymbol === 'all' ? undefined : selectedSymbol,
        status: filters.status === 'all' ? undefined : filters.status,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo
      });
      setTrades(response);
    } catch (error) {
      console.error('Error loading trades:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSymbolChange = (event) => {
    setSelectedSymbol(event.target.value);
  };

  const handleFilterChange = (event) => {
    setFilters({
      ...filters,
      [event.target.name]: event.target.value
    });
  };

  const handleApplyFilters = () => {
    loadTrades();
  };

  const handleResetFilters = () => {
    setFilters({
      status: 'all',
      dateFrom: '',
      dateTo: '',
    });
    loadTrades();
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Trade History
      </Typography>
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth>
              <InputLabel>Symbol</InputLabel>
              <Select
                value={selectedSymbol}
                onChange={handleSymbolChange}
                label="Symbol"
                disabled={loadingSymbols}
              >
                <MenuItem value="all">All Symbols</MenuItem>
                {symbols?.map((symbol) => (
                  <MenuItem key={symbol} value={symbol}>{symbol}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={3}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                label="Status"
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="OPEN">Open</MenuItem>
                <MenuItem value="CLOSED">Closed</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={2}>
            <TextField
              name="dateFrom"
              label="From Date"
              type="date"
              fullWidth
              value={filters.dateFrom}
              onChange={handleFilterChange}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={2}>
            <TextField
              name="dateTo"
              label="To Date"
              type="date"
              fullWidth
              value={filters.dateTo}
              onChange={handleFilterChange}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Grid>
          
          <Grid item xs={12} sm={2}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button 
                variant="contained" 
                onClick={handleApplyFilters}
                sx={{ flex: 1 }}
              >
                Apply
              </Button>
              <Button 
                variant="outlined" 
                onClick={handleResetFilters}
                sx={{ flex: 1 }}
              >
                Reset
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
      
      <TradeHistoryTable trades={trades} loading={loading} />
    </Box>
  );
};

export default TradeHistory;

// frontend/src/pages/Settings.js
import React, { useState } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import SaveIcon from '@mui/icons-material/Save';
import SecurityIcon from '@mui/icons-material/Security';
import NotificationsIcon from '@mui/icons-material/Notifications';
import BackupIcon from '@mui/icons-material/Backup';
import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';
import Tab from '@mui/material/Tab';
import useApiSettings from '../hooks/useApiSettings';

const Settings = () => {
  const [tab, setTab] = useState('1');
  const { settings, loading, saveSettings } = useApiSettings();
  const [apiSettings, setApiSettings] = useState({
    apiKey: '',
    secretKey: '',
    passphrase: '',
    demoMode: true
  });
  const [notificationSettings, setNotificationSettings] = useState({
    enableEmailNotifications: false,
    email: '',
    notifyOnTrade: true,
    notifyOnError: true
  });
  const [saved, setSaved] = useState(false);

  // Загрузка настроек при монтировании
  React.useEffect(() => {
    if (settings) {
      setApiSettings({
        apiKey: settings.apiKey || '',
        secretKey: settings.secretKey || '',
        passphrase: settings.passphrase || '',
        demoMode: settings.demoMode !== undefined ? settings.demoMode : true
      });
      
      if (settings.notifications) {
        setNotificationSettings({
          enableEmailNotifications: settings.notifications.enableEmail || false,
          email: settings.notifications.email || '',
          notifyOnTrade: settings.notifications.onTrade !== undefined ? settings.notifications.onTrade : true,
          notifyOnError: settings.notifications.onError !== undefined ? settings.notifications.onError : true
        });
      }
    }
  }, [settings]);

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  const handleApiSettingsChange = (event) => {
    const { name, value, checked } = event.target;
    setApiSettings({
      ...apiSettings,
      [name]: name === 'demoMode' ? checked : value
    });
  };

  const handleNotificationSettingsChange = (event) => {
    const { name, value, checked } = event.target;
    setNotificationSettings({
      ...notificationSettings,
      [name]: name === 'enableEmailNotifications' || name === 'notifyOnTrade' || name === 'notifyOnError' 
        ? checked 
        : value
    });
  };

  const handleSaveSettings = async () => {
    try {
      await saveSettings({
        apiKey: apiSettings.apiKey,
        secretKey: apiSettings.secretKey,
        passphrase: apiSettings.passphrase,
        demoMode: apiSettings.demoMode,
        notifications: {
          enableEmail: notificationSettings.enableEmailNotifications,
          email: notificationSettings.email,
          onTrade: notificationSettings.notifyOnTrade,
          onError: notificationSettings.notifyOnError
        }
      });
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      
      {saved && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Settings saved successfully!
        </Alert>
      )}
      
      <Paper sx={{ mb: 4 }}>
        <TabContext value={tab}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <TabList onChange={handleTabChange} aria-label="settings tabs">
              <Tab icon={<SecurityIcon />} label="API Settings" value="1" />
              <Tab icon={<NotificationsIcon />} label="Notifications" value="2" />
              <Tab icon={<BackupIcon />} label="Backup & Restore" value="3" />
            </TabList>
          </Box>
          
          <TabPanel value="1">
            <Typography variant="h6" gutterBottom>
              BitGet API Configuration
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Enter your BitGet API credentials to connect the bot to your account.
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  label="API Key"
                  name="apiKey"
                  value={apiSettings.apiKey}
                  onChange={handleApiSettingsChange}
                  fullWidth
                  variant="outlined"
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="Secret Key"
                  name="secretKey"
                  value={apiSettings.secretKey}
                  onChange={handleApiSettingsChange}
                  fullWidth
                  variant="outlined"
                  type="password"
                />
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="Passphrase"
                  name="passphrase"
                  value={apiSettings.passphrase}
                  onChange={handleApiSettingsChange}
                  fullWidth
                  variant="outlined"
                  type="password"
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={apiSettings.demoMode}
                      onChange={handleApiSettingsChange}
                      name="demoMode"
                      color="primary"
                    />
                  }
                  label="Use Demo Mode (Simulated Trading)"
                />
              </Grid>
            </Grid>
          </TabPanel>
          
          <TabPanel value="2">
            <Typography variant="h6" gutterBottom>
              Notification Settings
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Configure notifications for important bot events.
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={notificationSettings.enableEmailNotifications}
                      onChange={handleNotificationSettingsChange}
                      name="enableEmailNotifications"
                      color="primary"
                    />
                  }
                  label="Enable Email Notifications"
                />
              </Grid>
              
              {notificationSettings.enableEmailNotifications && (
                <Grid item xs={12}>
                  <TextField
                    label="Email Address"
                    name="email"
                    value={notificationSettings.email}
                    onChange={handleNotificationSettingsChange}
                    fullWidth
                    variant="outlined"
                    type="email"
                  />
                </Grid>
              )}
              
              <Grid item xs={12}>
                <Typography variant="subtitle1">Notification Triggers</Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={notificationSettings.notifyOnTrade}
                      onChange={handleNotificationSettingsChange}
                      name="notifyOnTrade"
                      color="primary"
                    />
                  }
                  label="Notify on Trade Execution"
                />
              </Grid>
              
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={notificationSettings.notifyOnError}
                      onChange={handleNotificationSettingsChange}
                      name="notifyOnError"
                      color="primary"
                    />
                  }
                  label="Notify on Bot Errors"
                />
              </Grid>
            </Grid>
          </TabPanel>
          
          <TabPanel value="3">
            <Typography variant="h6" gutterBottom>
              Backup & Restore
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Backup your bot configurations and trading history.
            </Typography>
            
            <Box sx={{ mb: 3 }}>
              <Button variant="contained" color="primary">
                Export All Data
              </Button>
            </Box>
            
            <Divider sx={{ my: 3 }} />
            
            <Typography variant="h6" gutterBottom>
              Restore Data
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Restore a previously exported backup file.
            </Typography>
            
            <Button variant="outlined" color="primary" component="label">
              Choose Backup File
              <input type="file" hidden />
            </Button>
          </TabPanel>
        </TabContext>
      </Paper>
      
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<SaveIcon />}
          onClick={handleSaveSettings}
          disabled={loading}
        >
          Save Settings
        </Button>
      </Box>
    </Box>
  );
};

export default Settings;

// frontend/src/hooks/useAccountBalance.js
import { useState, useEffect } from 'react';
import { getAccountBalance } from '../services/accountService';

const useAccountBalance = () => {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        setLoading(true);
        const data = await getAccountBalance();
        setBalance(data);
        setError(null);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();

    // Обновление каждые 60 секунд
    const interval = setInterval(fetchBalance, 60000);

    return () => clearInterval(interval);
  }, []);

  return { balance, loading, error };
};

export default useAccountBalance;

// frontend/src/hooks/useSymbols.js
import { useState, useEffect } from 'react';
import { getSymbols } from '../services/marketService';

const useSymbols = () => {
  const [symbols, setSymbols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSymbols = async () => {
      try {
        setLoading(true);
        const data = await getSymbols();
        
        // Извлекаем символы из ответа API
        const symbolList = data?.data?.map(item => item.symbol) || [];
        setSymbols(symbolList);
        setError(null);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSymbols();
  }, []);

  return { symbols, loading, error };
};

export default useSymbols;

// frontend/src/hooks/useBotStatus.js
import { useState, useEffect } from 'react';
import { getBotStatus } from '../services/botService';

const useBotStatus = (symbol) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStatus = async () => {
    if (!symbol) {
      setStatus(null);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const data = await getBotStatus(symbol);
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    
    // Обновление каждые 30 секунд
    const interval = setInterval(fetchStatus, 30000);
    
    return () => clearInterval(interval);
  }, [symbol]);

  return { status, loading, error, refetch: fetchStatus };
};

export default useBotStatus;

// frontend/src/hooks/useKlines.js
import { useState, useEffect } from 'react';
import { getKlines } from '../services/marketService';

const useKlines = (symbol, interval = '1m', limit = 100) => {
  const [klines, setKlines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!symbol) {
      setKlines([]);
      setLoading(false);
      return;
    }
    
    const fetchKlines = async () => {
      try {
        setLoading(true);
        const data = await getKlines(symbol, interval, limit);
        setKlines(data?.data || []);
        setError(null);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchKlines();
    
    // Обновление данных каждую минуту
    const intervalId = setInterval(fetchKlines, 60000);
    
    return () => clearInterval(intervalId);
  }, [symbol, interval, limit]);

  return { klines, loading, error };
};

export default useKlines;

// frontend/src/hooks/useTicker.js
import { useState, useEffect } from 'react';
import { getTicker } from '../services/marketService';

const useTicker = (symbol) => {
  const [ticker, setTicker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!symbol) {
      setTicker(null);
      setLoading(false);
      return;
    }
    
    const fetchTicker = async () => {
      try {
        setLoading(true);
        const data = await getTicker(symbol);
        setTicker(data);
        setError(null);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTicker();
    
    // Обновление данных каждые 5 секунд
    const interval = setInterval(fetchTicker, 5000);
    
    return () => clearInterval(interval);
  }, [symbol]);

  return { ticker, loading, error };
};

export default useTicker;

// frontend/src/hooks/useApiSettings.js
import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../services/settingsService';

const useApiSettings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const data = await getSettings();
        setSettings(data);
        setError(null);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const saveSettings = async (newSettings) => {
    try {
      setLoading(true);
      const data = await updateSettings(newSettings);
      setSettings(data);
      setError(null);
      return data;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { settings, loading, error, saveSettings };
};

export default useApiSettings;

// frontend/src/services/api.js
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor для обработки ошибок
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export default api;

// frontend/src/services/botService.js
import api from './api';

export const getBotStatus = async (symbol) => {
  return api.get(`/bot/status?symbol=${symbol}`);
};

export const startBot = async (symbol, config) => {
  return api.post('/bot/start', { symbol, config });
};

export const stopBot = async (symbol) => {
  return api.post('/bot/stop', { symbol });
};

export const getBotConfig = async (symbol) => {
  return api.get(`/bot/config?symbol=${symbol}`);
};

export const updateBotConfig = async (symbol, config) => {
  return api.post('/bot/config', { symbol, config });
};

export const getBotStats = async (symbol) => {
  return api.get(`/bot/stats?symbol=${symbol}`);
};

// frontend/src/services/accountService.js
import api from './api';

export const getAccountBalance = async () => {
  return api.get('/account/balance');
};

export const getPositions = async (symbol) => {
  const url = symbol ? `/account/positions?symbol=${symbol}` : '/account/positions';
  return api.get(url);
};

export const getOrders = async (symbol, status, limit) => {
  let url = '/account/orders';
  const params = [];
  
  if (symbol) params.push(`symbol=${symbol}`);
  if (status) params.push(`status=${status}`);
  if (limit) params.push(`limit=${limit}`);
  
  if (params.length > 0) {
    url += `?${params.join('&')}`;
  }
  
  return api.get(url);
};

// frontend/src/services/marketService.js
import api from './api';

export const getSymbols = async () => {
  return api.get('/market/symbols');
};

export const getKlines = async (symbol, interval = '1m', limit = 100) => {
  return api.get(`/market/klines/${symbol}?interval=${interval}&limit=${limit}`);
};

export const getTicker = async (symbol) => {
  return api.get(`/market/ticker/${symbol}`);
};

// frontend/src/services/tradeService.js
import api from './api';

export const getTrades = async (filters = {}) => {
  const { symbol, status, dateFrom, dateTo, limit = 100 } = filters;
  
  let url = '/trades';
  const params = [];
  
  if (symbol) params.push(`symbol=${symbol}`);
  if (status) params.push(`status=${status}`);
  if (dateFrom) params.push(`dateFrom=${dateFrom}`);
  if (dateTo) params.push(`dateTo=${dateTo}`);
  if (limit) params.push(`limit=${limit}`);
  
  if (params.length > 0) {
    url += `?${params.join('&')}`;
  }
  
  // Для тестирования
  // Эмуляция ответа API
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([
        {
          _id: '1',
          symbol: 'BTCUSDT',
          botId: 'bot1',
          direction: 'LONG',
          entryPrice: 60000,
          exitPrice: 62000,
          quantity: 0.01,
          entryTime: new Date(Date.now() - 3600000),
          exitTime: new Date(),
          profitLoss: 200,
          status: 'CLOSED',
          dcaCount: 0,
          closeReason: 'TRAILING_STOP'
        },
        {
          _id: '2',
          symbol: 'ETHUSDT',
          botId: 'bot2',
          direction: 'SHORT',
          entryPrice: 4000,
          exitPrice: 3800,
          quantity: 0.1,
          entryTime: new Date(Date.now() - 7200000),
          exitTime: new Date(Date.now() - 3600000),
          profitLoss: 200,
          status: 'CLOSED',
          dcaCount: 1,
          closeReason: 'MAX_DURATION'
        },
        {
          _id: '3',
          symbol: 'SOLUSDT',
          botId: 'bot3',
          direction: 'LONG',
          entryPrice: 300,
          quantity: 1,
          entryTime: new Date(Date.now() - 1800000),
          status: 'OPEN',
          dcaCount: 0
        }
      ]);
    }, 500);
  });
};

// frontend/src/services/settingsService.js
import api from './api';

export const getSettings = async () => {
  // Для тестирования
  // Эмуляция ответа API
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        apiKey: 'test_api_key',
        secretKey: '********',
        passphrase: '********',
        demoMode: true,
        notifications: {
          enableEmail: false,
          email: '',
          onTrade: true,
          onError: true
        }
      });
    }, 500);
  });
};

export const updateSettings = async (settings) => {
  // Для тестирования
  // Эмуляция ответа API
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(settings);
    }, 500);
  });
};

// frontend/src/utils/formatters.js
export const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleString();
};

export const formatCurrency = (value) => {
  if (value === undefined || value === null) return '-';
  return parseFloat(value).toFixed(2);
};

export const formatPercentage = (value) => {
  if (value === undefined || value === null) return '-';
  return parseFloat(value).toFixed(2) + '%';
};

// frontend/src/utils/dataFormatters.js
export const formatCandlestickData = (klines) => {
  if (!klines || !Array.isArray(klines)) return [];
  
  return klines.map(candle => {
    // Формат API BitGet: [timestamp, open, high, low, close, volume]
    return {
      time: parseInt(candle[0]) / 1000, // конвертировать в секунды для lightweight-charts
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5])
    };
  });
};
