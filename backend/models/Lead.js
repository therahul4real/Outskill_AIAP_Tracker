const mongoose = require('mongoose');

// Sub-document for a single payment transaction (a lead can have many)
const activeLinkSchema = new mongoose.Schema(
  {
    plink: {
      type: String,
      trim: true,
      default: '',
    },
    employeeCode: {
      type: String,
      trim: true,
      default: '',
    }
  },
  { timestamps: true }
);

const paymentSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      trim: true,
      default: '',
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    amount: {
      type: Number,
      default: 0,
    },
    paymentMode: {
      type: String,
      trim: true,
      default: '',
    },
    paymentType: {
      type: String,
      trim: true,
      default: '',
    },
    mm: {
      type: String, // Month (MM)
      trim: true,
      default: '',
    },
    source: {
      type: String,
      trim: true,
      default: '',
    },
    withGST: {
      type: Boolean,
      default: false,
    },
    paymentLink: {
      type: String, // the payment link this transaction belongs to
      trim: true,
      default: '',
    },
    employeeCode: {
      type: String, // employee associated with this payment's link
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

const leadSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      default: Date.now, // Date the lead was created/entered
    },
    leadOwner: {
      type: String,
      trim: true,
      default: '',
    },
    name: {
      // Not required: a lead can be created from a payment webhook
      // before we know the person's name (filled in later on registration)
      type: String,
      trim: true,
      default: '',
    },
    paymentEmailId: {
      type: String,
      required: true, // primary identifier — matched across registration & payment feeds
      trim: true,
      lowercase: true,
    },
    contactNo: {
      type: String, // kept as String to preserve leading zeros / "+" prefixes
      trim: true,
      default: '',
    },
    mrp: {
      type: Number,
      default: 0,
    },
    salePrice: {
      type: Number,
      default: 0,
    },
    amountPaid: {
      type: Number, // total of all payments in `payments`
      default: 0,
    },
    balanceLeft: {
      type: Number, // salePrice - amountPaid (0 while sale price is unknown)
      default: 0,
    },
    paymentType: {
      type: String, // flat copy of the latest payment's type for quick views
      trim: true,
      default: '',
    },
    mm: {
      type: String, // Month (MM)
      trim: true,
      default: '',
    },
    paymentMode: {
      type: String, // flat copy of the latest payment's mode for quick views
      trim: true,
      default: '',
    },
    paymentId: {
      type: String, // flat copy of the latest payment's ID for quick views
      trim: true,
      default: '',
    },
    payments: {
      type: [paymentSchema],
      default: [],
    },
    source: {
      type: String,
      trim: true,
      default: '',
    },
    program: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      trim: true,
      default: '',
    },
    newProgram: {
      type: String,
      trim: true,
      default: '',
    },
    onboardingPOC: {
      type: String,
      trim: true,
      default: '',
    },
    onboardingStatus: {
      type: String,
      trim: true,
      default: '',
    },
    onboardingDate: {
      type: Date,
    },
    remarksOfCall: {
      type: String,
      trim: true,
      default: '',
    },
    partialPaymentStatus: {
      type: String,
      trim: true,
      default: '',
    },
    lastDateOfFollowup: {
      type: Date,
    },
    refundMonth: {
      type: String,
      trim: true,
      default: '',
    },
    onboardingStatusCRM: {
      type: String, // Onboarding status (CRM)
      trim: true,
      default: '',
    },
    salesPOC: {
      type: String,
      trim: true,
      default: '',
    },
    withGST: {
      type: Boolean,
      default: false,
    },
    reChurnAndPaid: {
      type: Boolean, // Re-churn and paid
      default: false,
    },
    activeLinks: {
      type: [activeLinkSchema],
      default: [],
    }
  },
  {
    timestamps: true, // adds createdAt / updatedAt automatically
  }
);

// Helpful indexes for common lookups
leadSchema.index({ name: 1 });
leadSchema.index({ contactNo: 1 });
leadSchema.index({ paymentEmailId: 1 }, { unique: true }); // one record per email

module.exports = mongoose.model('Lead', leadSchema);