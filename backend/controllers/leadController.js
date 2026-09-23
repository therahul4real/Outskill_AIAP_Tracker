const Lead = require('../models/Lead');

/**
 * Field whitelist for each feed. Only these keys are ever read from the
 * incoming payloads, so unknown/extra fields from the external services
 * can never corrupt the records.
 */
const BASIC_INFO_FIELDS = [
  'name',
  'leadOwner',
  'contactNo',
  'program',
  'source',
  'status',
  'onboardingPOC',
  'salesPOC',
];

const PAYMENT_FIELDS = [
  'paymentType',
  'mm',
  'paymentMode',
  'source',
  'program',
  'status',
  'partialPaymentStatus',
  'withGST',
];

const normalizeEmail = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

const toDate = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const pickFields = (body, allowed) => {
  const patch = {};
  for (const field of allowed) {
    if (body[field] !== undefined && body[field] !== null && body[field] !== '') {
      patch[field] = body[field];
    }
  }
  return patch;
};

/**
 * POST /api/leads/basic-info
 * Feed #1 — basic info (e.g. a registration/lead-capture service).
 * Requires the email; upserts the lead by email and fills in the
 * basic fields that were provided.
 */
const upsertBasicInfo = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email || req.body.paymentEmailId);
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: 'Email is required (email or paymentEmailId)' });
    }

    const patch = pickFields(req.body, BASIC_INFO_FIELDS);

    const lead = await Lead.findOneAndUpdate(
      { paymentEmailId: email },
      { $set: patch },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    // createdAt === updatedAt only right after an upsert-created document
    const created = lead.createdAt.getTime() === lead.updatedAt.getTime();

    res.status(200).json({ success: true, created, data: lead });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};


/**
 * POST /api/leads/payment-link
 * Feed #3 — payment link service (adds an active payment link for a lead).
 *
 * Steps:
 *  1. Read & normalize the email from the payload (email / paymentEmailId).
 *     Missing email                          -> 400 bad request.
 *  2. Require the payment link itself.
 *     Missing link                           -> 400 bad request.
 *  3. Find the lead by paymentEmailId.
 *     Lead not found                         -> 404 (no record to attach to).
 *  4. Found: push { link, employeeCode } into the lead's activeLinks and save.
 *     Returns 200 with the updated lead.
 */
const paymentLink = async (req, res) => {
  try {
    // Step 1: email is the matching key across all feeds
    const email = normalizeEmail(req.body.email || req.body.paymentEmailId);
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: 'Email is required (email or paymentEmailId)' });
    }

    // Step 2: the payment link value itself is mandatory
    const link = (req.body.link || req.body.paymentLink || req.body.plink || '').toString().trim();
    if (!link) {
      return res
        .status(400)
        .json({ success: false, message: 'Payment link (link/paymentLink/plink) is required' });
    }

    const employeeCode = (req.body.employeeCode || '').toString().trim();

    // Step 3: find the user/lead by email — if not registered, fail with 404
    const lead = await Lead.findOne({ paymentEmailId: email });
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: `No lead found for email ${email} — register the lead first`,
      });
    }

    // Step 4: attach the payment link to the found lead
    lead.activeLinks.push({ plink: link, employeeCode });
    await lead.save();

    res.status(200).json({
      success: true,
      created: false,
      message: 'Payment link added to the lead',
      data: lead,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/leads/payment
 * Feed #2 — payment service (payment date, amount, payment ID, mode, ...).
 *
 * The PAYMENT LINK is the primary matching key (each link is generated for a
 * specific lead via POST /api/leads/payment-link):
 *  1. Link matches a lead's activeLinks -> payment recorded on that lead,
 *     stored with its paymentLink + employeeCode, and the lead's email is
 *     updated to the new incoming payment email.
 *  2. No link match (or no link sent)   -> fall back to email matching
 *     (legacy behaviour).
 *  3. Neither matches                   -> a NEW lead is created using the
 *     payment email as the main email.
 */
const recordPayment = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email || req.body.paymentEmailId);
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: 'Email is required in the payment payload' });
    }

    const amount = toNumber(req.body.amountPaid ?? req.body.amount);
    if (amount === undefined || amount <= 0) {
      return res
        .status(400)
        .json({ success: false, message: 'A positive amountPaid/amount is required' });
    }

    const payment = {
      paymentId: (req.body.paymentId || '').toString().trim(),
      paymentDate: toDate(req.body.paymentDate) || new Date(),
      amount,
      paymentMode: (req.body.paymentMode || '').toString().trim(),
      paymentType: (req.body.paymentType || '').toString().trim(),
      mm: (req.body.mm || '').toString().trim(),
      source: (req.body.source || '').toString().trim(),
      withGST: Boolean(req.body.withGST),
      paymentLink: (req.body.paymentLink || req.body.link || '').toString().trim(),
      employeeCode: (req.body.employeeCode || '').toString().trim(),
    };

    const salePrice = toNumber(req.body.salePrice);
    const mrp = toNumber(req.body.mrp);
    const extra = pickFields(req.body, PAYMENT_FIELDS);

    // ---- Step 1: primary lookup — match by payment link ----
    // The payment link is generated per lead (see POST /payment-link), so a
    // matching entry in any lead's activeLinks identifies the owner of this
    // payment regardless of which email the payment gateway reports.
    let lead = null;
    if (payment.paymentLink) {
      lead = await Lead.findOne({ 'activeLinks.plink': payment.paymentLink });
    }

    // ---- Step 2: fallback — old behaviour, match by email ----
    // Keeps payments without a link (or leads created before this system)
    // working exactly as before.
    if (!lead) {
      lead = await Lead.findOne({ paymentEmailId: email });
    }

    // ---- Step 3: no match at all — create a brand new record ----
    if (!lead) {
      const newLead = await Lead.create({
        paymentEmailId: email, // payment email becomes the main email id
        name: (req.body.name || '').toString().trim(), // may be empty
        date: payment.paymentDate,
        mrp: mrp ?? 0,
        salePrice: salePrice ?? 0,
        amountPaid: amount,
        balanceLeft: salePrice && salePrice > 0 ? salePrice - amount : 0,
        paymentId: payment.paymentId,
        paymentMode: payment.paymentMode,
        paymentType: payment.paymentType,
        mm: payment.mm,
        withGST: payment.withGST,
        payments: [payment],
        ...extra,
      });
      return res.status(201).json({
        success: true,
        created: true,
        message: 'Payment email was not registered — new lead created from the payment',
        data: newLead,
      });
    }

    // ---- Registered email: guard against duplicate payment webhooks ----
    const isDuplicate =
      payment.paymentId &&
      lead.payments.some((p) => p.paymentId && p.paymentId === payment.paymentId);

    if (isDuplicate) {
      return res.status(200).json({
        success: true,
        created: false,
        duplicate: true,
        message: 'Payment already recorded for this paymentId — no double counting',
        data: lead,
      });
    }

    lead.payments.push(payment);
    if (mrp !== undefined) lead.mrp = mrp;
    if (salePrice !== undefined && salePrice > lead.salePrice) lead.salePrice = salePrice;
    
    lead.amountPaid = lead.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    lead.balanceLeft = lead.salePrice > 0 ? lead.salePrice - lead.amountPaid : 0;
    
    // Flat quick-view copies of the latest payment
    lead.paymentId = payment.paymentId || lead.paymentId;
    lead.paymentMode = payment.paymentMode || lead.paymentMode;
    lead.paymentType = payment.paymentType || lead.paymentType;
    lead.mm = payment.mm || lead.mm;
    if (payment.withGST) lead.withGST = true;
    
    // ---- Step 4: sync the lead's email with the new incoming payment email ----
    // The payment link identifies the person; their email may have changed,
    // so always keep paymentEmailId on the email that came with this payment.
    if (email !== lead.paymentEmailId) {
      lead.paymentEmailId = email;
    }
    lead.leadOwner = payment.employeeCode;

    Object.assign(lead, extra);
    await lead.save();

    res.status(200).json({ success: true, created: false, data: lead });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = { upsertBasicInfo, recordPayment ,paymentLink};
