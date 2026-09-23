import { InlineKeyboard } from 'grammy';
import { BotContext } from '../../../infrastructure/telegram/bot';
import { userService } from '../../users/user.service';
import { aiService } from '../../ai/ai.service';
import { transactionService } from '../../transactions/transaction.service';
import { categoryService } from '../../categories/category.service';
import { analyticsService } from '../../analytics/analytics.service';
import { budgetService } from '../../budgets/budget.service';
import { exportService } from '../../exports/export.service';
import { handleBalance } from './balance.handler';
import { handleSummary } from './summary.handler';
import { handleHelp } from './help.handler';
import { toMinorUnits, formatMoney } from '../../../shared/utils/money';
import { getDateRange, formatDateInTz } from '../../../shared/utils/date';
import { Currency, CATEGORY_ICONS, SUPPORTED_CURRENCIES } from '../../../shared/types';
import { AIResponse, ParsedTransaction } from '../../ai/ai.types';
import { UserWithSettings } from '../../users/user.types';
import { DuplicateTransactionError, NotFoundError } from '../../../shared/errors';
import { logger } from '../../../shared/logger';
import { config } from '../../../config';
import { prisma } from '../../../infrastructure/database/client';
import { format } from 'date-fns';

export async function handleTextMessage(ctx: BotContext): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  const telegramUser = ctx.from;
  if (!telegramUser) return;

  let user: UserWithSettings;
  try {
    user = await userService.findOrCreateFromTelegram({
      telegramUserId: BigInt(telegramUser.id),
      telegramUsername: telegramUser.username,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
    });
    ctx.session.userId = user.id;
  } catch (err) {
    logger.error({ err }, 'Failed to find/create user in text handler');
    await ctx.reply('Something went wrong. Please try /start again.');
    return;
  }

  if (!aiService.isConfigured()) {
    await ctx.reply(
      '🤖 AI processing requires *DeepSeek* to be configured.\n\n' +
        'Set `DEEPSEEK_API_KEY` in your environment, then restart.\n\n' +
        'Available commands:\n' +
        '/balance · /summary · /expenses · /income\n' +
        '/report · /export · /categories · /budget',
      { parse_mode: 'Markdown' },
    );
    return;
  }

  await ctx.api.sendChatAction(ctx.chat!.id, 'typing');

  let result: AIResponse;
  try {
    result = await aiService.processMessage(text, user.id, user);
  } catch (err) {
    logger.error({ err, userId: user.id }, 'AI processing failed');
    await ctx.reply(
      "Sorry, I had trouble understanding that. Please try again or use a command (/help).",
    );
    return;
  }

  try {
    await dispatchIntent(ctx, result, user);
  } catch (err) {
    logger.error({ err, userId: user.id, intent: result.intent }, 'Intent dispatch failed');
    await ctx.reply('Something went wrong processing that request. Please try again.');
  }
}

async function dispatchIntent(
  ctx: BotContext,
  result: AIResponse,
  user: UserWithSettings,
): Promise<void> {
  switch (result.intent) {
    case 'CREATE_TRANSACTION':
    case 'CREATE_MULTIPLE_TRANSACTIONS':
      await handleCreateTransaction(ctx, result, user);
      break;

    case 'GET_BALANCE':
      await handleBalance(ctx);
      break;

    case 'GET_SUMMARY':
      await handleSummary(ctx, result.query?.period ?? 'this_month');
      break;

    case 'GET_CATEGORY_SUMMARY':
      await handleCategorySummary(ctx, result, user);
      break;

    case 'COMPARE_PERIODS':
      await handleComparePeriods(ctx, result, user);
      break;

    case 'SET_BUDGET':
      await handleSetBudget(ctx, result, user);
      break;

    case 'GET_BUDGET':
    case 'GET_BUDGET_STATUS':
      await handleGetBudget(ctx, result, user);
      break;

    case 'EXPORT_CSV':
      await handleExportCSV(ctx, result, user);
      break;

    case 'EXPORT_PDF':
      await handleExportPDF(ctx, result, user);
      break;

    case 'UPDATE_TRANSACTION':
      await handleUpdateTransaction(ctx, result, user);
      break;

    case 'DELETE_TRANSACTION':
      await handleDeleteTransaction(ctx, user);
      break;

    case 'SET_REMINDER':
      await handleSetReminder(ctx, result, user);
      break;

    case 'CREATE_CATEGORY':
      await handleCreateCategory(ctx, result, user);
      break;

    case 'HELP':
      await handleHelp(ctx);
      break;

    case 'UNKNOWN':
    default:
      await ctx.reply(
        result.message ??
          "I'm not sure what you mean. Try something like:\n" +
          '_"Spent 5k on food"_ or _"What is my balance?"_\n\n' +
          'Type /help to see all commands.',
        { parse_mode: 'Markdown' },
      );
  }
}

async function handleCreateTransaction(
  ctx: BotContext,
  result: AIResponse,
  user: UserWithSettings,
): Promise<void> {
  const txData = result.transactions ?? [];
  if (txData.length === 0) {
    await ctx.reply('I understood you want to record a transaction, but I need more details. How much and for what?');
    return;
  }

  if (result.needsConfirmation) {
    const confirmText = txData
      .map((t) => `${t.type === 'INCOME' ? 'Income' : 'Expense'}: ${t.currency} ${t.amount.toLocaleString()} — ${t.category}`)
      .join('\n');
    await ctx.reply(
      `Please confirm:\n\n${confirmText}\n\n_(Reply "yes" to confirm or "no" to cancel)_`,
      { parse_mode: 'Markdown' },
    );
    ctx.session.awaitingConfirmation = {
      type: 'CREATE_TRANSACTION',
      data: result,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };
    return;
  }

  const currency = (txData[0].currency?.toUpperCase() ?? user.defaultCurrency) as Currency;
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    await ctx.reply(`Unsupported currency: ${currency}. Supported: ${SUPPORTED_CURRENCIES.join(', ')}`);
    return;
  }

  const created = [];
  for (const tx of txData) {
    try {
      const cat = await categoryService.findOrCreate(tx.category, user.id);
      const amountMinor = toMinorUnits(tx.amount, currency);
      const txDate = new Date(tx.date);
      if (isNaN(txDate.getTime())) {
        await ctx.reply(`Invalid date: ${tx.date}. Please try again.`);
        return;
      }

      const savedTx = await transactionService.create({
        userId: user.id,
        type: tx.type as any,
        amountMinor,
        currency,
        categoryId: cat.id,
        description: tx.description,
        notes: tx.notes,
        transactionDate: txDate,
        source: 'TEXT',
      });
      created.push({ tx, savedTx, cat, amountMinor });
    } catch (err) {
      if (err instanceof DuplicateTransactionError) {
        await ctx.reply(
          `⚠️ This looks like a duplicate transaction (same amount recorded in the last 5 minutes).\n\n` +
            `To record it anyway, reply "record duplicate".`,
        );
        ctx.session.awaitingConfirmation = {
          type: 'CREATE_TRANSACTION',
          data: result,
          expiresAt: Date.now() + 5 * 60 * 1000,
          skipDuplicateCheck: true,
        };
        return;
      }
      throw err;
    }
  }

  if (created.length === 0) return;

  if (created.length === 1) {
    const { tx, savedTx, cat, amountMinor } = created[0];
    ctx.session.lastTransactionId = savedTx.id;

    const icon = cat.icon ?? CATEGORY_ICONS[cat.name] ?? (tx.type === 'INCOME' ? '💵' : '📌');
    const tz = user.timezone ?? config.DEFAULT_TIMEZONE;
    const dateStr = formatDateInTz(savedTx.transactionDate, tz, 'MMM d, yyyy');
    const label = tx.type === 'INCOME' ? 'Income' : 'Expense';

    const keyboard = new InlineKeyboard()
      .text('Undo', `undo:${savedTx.id}`)
      .text('Edit Amount', `edit:${savedTx.id}`);

    await ctx.reply(
      `✅ *${label} recorded*\n\n` +
        `*${formatMoney(amountMinor, currency)}*\n` +
        `${icon} ${cat.name}\n` +
        `📅 ${dateStr}`,
      { parse_mode: 'Markdown', reply_markup: keyboard },
    );

    // Check budget alert
    await checkAndSendBudgetAlert(ctx, user, savedTx.categoryId, currency);
  } else {
    // Multiple transactions
    const lastId = created[created.length - 1].savedTx.id;
    ctx.session.lastTransactionId = lastId;

    let text = `✅ *${created.length} transactions recorded*\n\n`;
    for (const { tx, amountMinor } of created) {
      const icon = CATEGORY_ICONS[tx.category] ?? (tx.type === 'INCOME' ? '💵' : '📌');
      text += `${icon} ${tx.category} — ${formatMoney(amountMinor, currency)}\n`;
    }
    await ctx.reply(text, { parse_mode: 'Markdown' });
  }
}

async function checkAndSendBudgetAlert(
  ctx: BotContext,
  user: UserWithSettings,
  categoryId: string | null,
  currency: string,
): Promise<void> {
  if (!categoryId) return;
  try {
    const usage = await budgetService.checkCategoryUsage(user.id, categoryId, currency, user.timezone);
    if (!usage) return;

    if (usage.isOverBudget) {
      await ctx.reply(
        `🔴 *Budget exceeded!*\n` +
          `${usage.budget.category?.name ?? usage.budget.name}: ` +
          `${formatMoney(usage.spent, currency as Currency)} / ${formatMoney(usage.budget.amountMinor, currency as Currency)} ` +
          `(${usage.percentage}%)`,
        { parse_mode: 'Markdown' },
      );
    } else if (usage.isNearLimit) {
      await ctx.reply(
        `🟡 *Budget alert:* ${usage.budget.category?.name ?? usage.budget.name} is ${usage.percentage}% used.`,
        { parse_mode: 'Markdown' },
      );
    }
  } catch (_) {
    // Non-critical
  }
}

async function handleCategorySummary(
  ctx: BotContext,
  result: AIResponse,
  user: UserWithSettings,
): Promise<void> {
  const catName = result.query?.category;
  const period = result.query?.period ?? 'this_month';

  if (!catName) {
    await ctx.reply('Which category would you like to see? E.g., _"Show me my food spending"_', { parse_mode: 'Markdown' });
    return;
  }

  const cat = await categoryService.findByName(catName, user.id);
  const currency = user.defaultCurrency as Currency;
  const tz = user.timezone ?? config.DEFAULT_TIMEZONE;
  const { startDate, endDate, label } = getDateRange(period, tz);
  const summary = await analyticsService.getSummary(user.id, startDate, endDate, currency, label);
  const catData = cat
    ? summary.byCategory.find((b) => b.categoryId === cat.id)
    : summary.byCategory.find((b) => b.categoryName.toLowerCase() === catName.toLowerCase());

  if (!catData) {
    await ctx.reply(`No ${catName} expenses found for ${label}.`);
    return;
  }

  await ctx.reply(
    `${catData.categoryIcon} *${catData.categoryName}* — ${label}\n\n` +
      `Spent: \`${formatMoney(catData.total, currency)}\`\n` +
      `Transactions: ${catData.transactionCount}\n` +
      `Of total expenses: ${Math.round(catData.percentage)}%`,
    { parse_mode: 'Markdown' },
  );
}

async function handleComparePeriods(
  ctx: BotContext,
  result: AIResponse,
  user: UserWithSettings,
): Promise<void> {
  const period1 = result.query?.period ?? 'this_month';
  const period2 = result.query?.compareTo ?? 'last_month';
  const currency = user.defaultCurrency as Currency;
  const tz = user.timezone ?? config.DEFAULT_TIMEZONE;

  const [r1, r2] = await Promise.all([
    (() => {
      const { startDate, endDate, label } = getDateRange(period1, tz);
      return analyticsService.getSummary(user.id, startDate, endDate, currency, label);
    })(),
    (() => {
      const { startDate, endDate, label } = getDateRange(period2, tz);
      return analyticsService.getSummary(user.id, startDate, endDate, currency, label);
    })(),
  ]);

  const expChange = r1.expenses - r2.expenses;
  const changeSign = expChange > 0n ? '+' : '';
  const changeLabel = expChange > 0n ? 'more' : expChange < 0n ? 'less' : 'same';

  await ctx.reply(
    `📊 *Comparison*\n\n` +
      `*${r1.label}*\n` +
      `  Income: \`${formatMoney(r1.income, currency)}\`\n` +
      `  Expenses: \`${formatMoney(r1.expenses, currency)}\`\n\n` +
      `*${r2.label}*\n` +
      `  Income: \`${formatMoney(r2.income, currency)}\`\n` +
      `  Expenses: \`${formatMoney(r2.expenses, currency)}\`\n\n` +
      `_${r1.label}: ${changeSign}${formatMoney(expChange < 0n ? -expChange : expChange, currency)} ${changeLabel} spending_`,
    { parse_mode: 'Markdown' },
  );
}

async function handleSetBudget(
  ctx: BotContext,
  result: AIResponse,
  user: UserWithSettings,
): Promise<void> {
  const budgetData = result.budget;
  if (!budgetData) {
    await ctx.reply('Please specify: category, amount, and period. E.g., _"Set food budget to 80k monthly"_', { parse_mode: 'Markdown' });
    return;
  }

  const currency = (budgetData.currency?.toUpperCase() ?? user.defaultCurrency) as Currency;
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    await ctx.reply(`Unsupported currency: ${currency}`);
    return;
  }

  const cat = await categoryService.findOrCreate(budgetData.category, user.id);
  const amountMinor = toMinorUnits(budgetData.amount, currency);

  await budgetService.set(user.id, {
    userId: user.id,
    categoryId: cat.id,
    name: `${cat.name} ${budgetData.period} Budget`,
    amountMinor,
    currency,
    period: budgetData.period as any,
  });

  await ctx.reply(
    `✅ *Budget set*\n\n` +
      `${CATEGORY_ICONS[cat.name] ?? '📊'} ${cat.name}: ${formatMoney(amountMinor, currency)} per ${budgetData.period.toLowerCase()}`,
    { parse_mode: 'Markdown' },
  );
}

async function handleGetBudget(
  ctx: BotContext,
  result: AIResponse,
  user: UserWithSettings,
): Promise<void> {
  const catName = result.query?.category;
  const currency = user.defaultCurrency as Currency;
  const tz = user.timezone ?? config.DEFAULT_TIMEZONE;

  if (catName) {
    const cat = await categoryService.findByName(catName, user.id);
    const usage = cat
      ? await budgetService.checkCategoryUsage(user.id, cat.id, currency, tz)
      : null;

    if (!usage) {
      await ctx.reply(`No budget set for *${catName}*. Try: _"Set ${catName} budget to 50k monthly"_`, { parse_mode: 'Markdown' });
      return;
    }
    const icon = usage.budget.category ? (CATEGORY_ICONS[usage.budget.category.name] ?? '📊') : '📊';
    const statusIcon = usage.isOverBudget ? '🔴' : usage.isNearLimit ? '🟡' : '🟢';
    await ctx.reply(
      `${statusIcon} *${catName} Budget*\n\n` +
        `Spent: \`${formatMoney(usage.spent, currency)}\`\n` +
        `Budget: \`${formatMoney(usage.budget.amountMinor, currency)}\`\n` +
        `Remaining: \`${formatMoney(usage.remaining < 0n ? 0n : usage.remaining, currency)}\`\n` +
        `Used: ${buildBar(usage.percentage)} ${Math.min(usage.percentage, 100)}%`,
      { parse_mode: 'Markdown' },
    );
  } else {
    // Show all budgets — reuse the budget handler logic inline
    const usages = await budgetService.getAllUsage(user.id, currency, tz);
    if (usages.length === 0) {
      await ctx.reply(`No budgets set. Try: _"Set food budget to 80k monthly"_`, { parse_mode: 'Markdown' });
      return;
    }
    let text = '💰 *Budgets*\n\n';
    for (const u of usages) {
      const catName2 = u.budget.category?.name ?? u.budget.name;
      const statusIcon = u.isOverBudget ? '🔴' : u.isNearLimit ? '🟡' : '🟢';
      text +=
        `${statusIcon} *${catName2}*: ` +
        `${formatMoney(u.spent, currency)} / ${formatMoney(u.budget.amountMinor, currency)} ` +
        `(${Math.min(u.percentage, 100)}%)\n`;
    }
    await ctx.reply(text, { parse_mode: 'Markdown' });
  }
}

function buildBar(percentage: number): string {
  const filled = Math.min(Math.round(percentage / 10), 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

async function handleExportCSV(
  ctx: BotContext,
  result: AIResponse,
  user: UserWithSettings,
): Promise<void> {
  const processingMsg = await ctx.reply('📁 Generating CSV export...');
  try {
    const period = result.query?.period ?? 'this_month';
    const exportResult = await exportService.exportCSV(user, period);
    await ctx.api.deleteMessage(ctx.chat!.id, processingMsg.message_id).catch(() => null);
    await ctx.replyWithDocument(exportResult.url, { caption: `📁 Transaction export · ${Math.round(exportResult.bytes / 1024)} KB` });
  } catch (err) {
    await ctx.api.deleteMessage(ctx.chat!.id, processingMsg.message_id).catch(() => null);
    await ctx.reply('Failed to generate export. Make sure Cloudinary is configured.');
    logger.error({ err }, 'CSV export failed');
  }
}

async function handleExportPDF(
  ctx: BotContext,
  result: AIResponse,
  user: UserWithSettings,
): Promise<void> {
  const processingMsg = await ctx.reply('📄 Generating PDF report...');
  try {
    const period = result.query?.period ?? 'this_month';
    const exportResult = await exportService.exportPDF(user, period);
    await ctx.api.deleteMessage(ctx.chat!.id, processingMsg.message_id).catch(() => null);
    await ctx.replyWithDocument(exportResult.url, { caption: `📄 Financial report · ${Math.round(exportResult.bytes / 1024)} KB` });
  } catch (err) {
    await ctx.api.deleteMessage(ctx.chat!.id, processingMsg.message_id).catch(() => null);
    await ctx.reply('Failed to generate report. Make sure Cloudinary is configured.');
    logger.error({ err }, 'PDF export failed');
  }
}

async function handleUpdateTransaction(
  ctx: BotContext,
  result: AIResponse,
  user: UserWithSettings,
): Promise<void> {
  const txId = ctx.session.lastTransactionId;
  if (!txId) {
    await ctx.reply('No recent transaction to update. Please record a transaction first.');
    return;
  }

  const updateData = result.update;
  if (!updateData) {
    await ctx.reply('What would you like to change? (amount, category, description, or date)');
    return;
  }

  try {
    const currency = user.defaultCurrency as Currency;
    const updates: Record<string, unknown> = {};

    if (updateData.amount !== undefined) updates['amountMinor'] = toMinorUnits(updateData.amount, currency);
    if (updateData.description !== undefined) updates['description'] = updateData.description;
    if (updateData.date !== undefined) updates['transactionDate'] = new Date(updateData.date);

    if (updateData.category !== undefined) {
      const cat = await categoryService.findOrCreate(updateData.category, user.id);
      updates['categoryId'] = cat.id;
    }

    await transactionService.update(txId, user.id, updates as any);
    await ctx.reply(`✅ Transaction updated.`);
  } catch (err) {
    if (err instanceof NotFoundError) {
      await ctx.reply('That transaction no longer exists.');
    } else {
      throw err;
    }
  }
}

async function handleDeleteTransaction(ctx: BotContext, user: UserWithSettings): Promise<void> {
  const txId = ctx.session.lastTransactionId;
  if (!txId) {
    await ctx.reply('No recent transaction to delete.');
    return;
  }

  const keyboard = new InlineKeyboard()
    .text('Yes, delete', `confirm_delete:${txId}`)
    .text('Cancel', 'cancel');

  await ctx.reply('Are you sure you want to delete the last transaction?', { reply_markup: keyboard });
}

async function handleSetReminder(
  ctx: BotContext,
  result: AIResponse,
  user: UserWithSettings,
): Promise<void> {
  const reminderData = result.reminder;
  if (!reminderData) {
    await ctx.reply('Please specify when you want to be reminded. E.g., _"Remind me to record expenses every day at 8pm"_', { parse_mode: 'Markdown' });
    return;
  }

  await prisma.reminder.create({
    data: {
      userId: user.id,
      message: reminderData.message,
      cronExpr: reminderData.cronExpr,
      timezone: user.timezone ?? config.DEFAULT_TIMEZONE,
      isActive: true,
    },
  });

  await ctx.reply(
    `⏰ *Reminder set*\n\n${reminderData.description}\n_"${reminderData.message}"_`,
    { parse_mode: 'Markdown' },
  );
}

async function handleCreateCategory(
  ctx: BotContext,
  result: AIResponse,
  user: UserWithSettings,
): Promise<void> {
  const catName = result.transactions?.[0]?.category;
  if (!catName) {
    await ctx.reply('What would you like to name the new category?');
    return;
  }

  const cat = await categoryService.findOrCreate(catName, user.id);
  await ctx.reply(`✅ Category *${cat.name}* is ready to use.`, { parse_mode: 'Markdown' });
}

// Handle pending confirmations (called by text handler when session.awaitingConfirmation is set)
export async function processPendingConfirmation(
  ctx: BotContext,
  pending: NonNullable<typeof ctx.session.awaitingConfirmation>,
  user: UserWithSettings,
): Promise<void> {
  ctx.session.awaitingConfirmation = undefined;

  if (pending.type === 'CREATE_TRANSACTION') {
    const result = pending.data as AIResponse;
    if (pending.skipDuplicateCheck) {
      // Force-create skipping duplicate check
      const txData = result.transactions ?? [];
      const currency = (txData[0]?.currency?.toUpperCase() ?? user.defaultCurrency) as Currency;
      for (const tx of txData) {
        const cat = await categoryService.findOrCreate(tx.category, user.id);
        const amountMinor = toMinorUnits(tx.amount, currency);
        const savedTx = await transactionService.create(
          {
            userId: user.id,
            type: tx.type as any,
            amountMinor,
            currency,
            categoryId: cat.id,
            description: tx.description,
            transactionDate: new Date(tx.date),
            source: 'TEXT',
          },
          true,
        );
        ctx.session.lastTransactionId = savedTx.id;
      }
      await ctx.reply(`✅ Transaction recorded (duplicate override).`);
    } else {
      await handleCreateTransaction(ctx, result, user);
    }
  }
}
