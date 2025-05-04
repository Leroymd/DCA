// Продолжение компонента ConfigForm
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
