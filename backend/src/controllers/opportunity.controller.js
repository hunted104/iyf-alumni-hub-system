const Opportunity = require("../models/opportunity.models");
const mongoose = require("mongoose");
const { AppError } = require("../middleware/error.middleware");

// Validation helpers
const validateObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const validateOpportunityInput = (body, isUpdate = false) => {
  const errors = [];
  const { title, company, location, type, description, deadline, contactInfo, applicationLink } = body;

  // Required fields (skip for updates if not provided)
  if (!isUpdate || body.hasOwnProperty("title")) {
    if (!title?.trim()) errors.push({ field: "title", message: "Title is required" });
    else if (title.trim().length < 3) errors.push({ field: "title", message: "Title must be at least 3 characters" });
    else if (title.trim().length > 200) errors.push({ field: "title", message: "Title cannot exceed 200 characters" });
  }

  if (!isUpdate || body.hasOwnProperty("company")) {
    if (!company?.trim()) errors.push({ field: "company", message: "Company name is required" });
    else if (company.trim().length > 100) errors.push({ field: "company", message: "Company name cannot exceed 100 characters" });
  }

  if (!isUpdate || body.hasOwnProperty("location")) {
    if (!location?.trim()) errors.push({ field: "location", message: "Location is required" });
    else if (location.trim().length > 100) errors.push({ field: "location", message: "Location cannot exceed 100 characters" });
  }

  if (!isUpdate || body.hasOwnProperty("type")) {
    if (!type) errors.push({ field: "type", message: "Opportunity type is required" });
    else if (!["Job", "Internship", "Announcement"].includes(type)) {
      errors.push({ field: "type", message: "Type must be Job, Internship, or Announcement" });
    }
  }

  if (!isUpdate || body.hasOwnProperty("description")) {
    if (!description?.trim()) errors.push({ field: "description", message: "Description is required" });
    else if (description.trim().length < 20) {
      errors.push({ field: "description", message: "Description must be at least 20 characters" });
    }
    else if (description.trim().length > 5000) {
      errors.push({ field: "description", message: "Description cannot exceed 5000 characters" });
    }
  }

  // Optional field validations
  if (deadline !== undefined && deadline !== null) {
    const date = new Date(deadline);
    if (isNaN(date.getTime())) {
      errors.push({ field: "deadline", message: "Deadline must be a valid date" });
    } else if (date < new Date().setHours(0, 0, 0, 0)) {
      errors.push({ field: "deadline", message: "Deadline cannot be in the past" });
    }
  }

  if (contactInfo !== undefined && contactInfo !== null) {
    if (contactInfo.length > 200) {
      errors.push({ field: "contactInfo", message: "Contact info cannot exceed 200 characters" });
    }
  }

  if (applicationLink !== undefined && applicationLink !== null) {
    if (applicationLink.length > 500) {
      errors.push({ field: "applicationLink", message: "Application link cannot exceed 500 characters" });
    }
    try {
      new URL(applicationLink);
    } catch {
      errors.push({ field: "applicationLink", message: "Application link must be a valid URL" });
    }
  }

  return errors;
};

const checkOwnership = (opportunity, user) => {
  return (
    opportunity.postedBy.toString() === user._id.toString() ||
    user.role === "admin"
  );
};

// @desc    Get all opportunities
// @route   GET /api/opportunities
// @access  Private
const getAllOpportunities = async (req, res, next) => {
  try {
    const { search, type, page = 1, limit = 10 } = req.query;
    const query = {};

    // Filter by type
    if (type && ["Job", "Internship", "Announcement"].includes(type)) {
      query.type = type;
    }

    // Text search
    if (search?.trim()) {
      query.$text = { $search: search.trim() };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * pageSize;

    const [opportunities, total] = await Promise.all([
      Opportunity.find(query)
        .populate("postedBy", "name email")
        .sort(search ? { score: { $meta: "textScore" } } : { createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      Opportunity.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: opportunities,
      pagination: {
        page: pageNum,
        pages: Math.ceil(total / pageSize),
        total,
        limit: pageSize,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single opportunity by ID
// @route   GET /api/opportunities/:id
// @access  Private
const getOpportunityById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      throw new AppError("Invalid opportunity ID format", 400);
    }

    const opportunity = await Opportunity.findById(id)
      .populate("postedBy", "name email")
      .lean();

    if (!opportunity) {
      throw new AppError(
        "Opportunity not found",
        404,
        null,
        "The opportunity may have been removed or the ID is incorrect"
      );
    }

    res.status(200).json({
      success: true,
      data: opportunity,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new opportunity
// @route   POST /api/opportunities
// @access  Private
const createOpportunity = async (req, res, next) => {
  try {
    const errors = validateOpportunityInput(req.body);
    if (errors.length > 0) {
      throw new AppError(
        errors.length === 1 ? errors[0].message : "Validation failed",
        400,
        errors
      );
    }

    const { title, company, location, type, description, deadline, contactInfo, applicationLink } = req.body;

    const opportunity = await Opportunity.create({
      title: title.trim(),
      company: company.trim(),
      location: location.trim(),
      type,
      description: description.trim(),
      deadline: deadline || null,
      contactInfo: contactInfo?.trim() || null,
      applicationLink: applicationLink?.trim() || null,
      postedBy: req.user._id,
    });

    const populated = await Opportunity.findById(opportunity._id)
      .populate("postedBy", "name email")
      .lean();

    res.status(201).json({
      success: true,
      message: "Opportunity created successfully",
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update opportunity
// @route   PUT /api/opportunities/:id
// @access  Private
const updateOpportunity = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      throw new AppError("Invalid opportunity ID format", 400);
    }

    const errors = validateOpportunityInput(req.body, true);
    if (errors.length > 0) {
      throw new AppError(
        errors.length === 1 ? errors[0].message : "Validation failed",
        400,
        errors
      );
    }

    const opportunity = await Opportunity.findById(id);

    if (!opportunity) {
      throw new AppError("Opportunity not found", 404);
    }

    if (!checkOwnership(opportunity, req.user)) {
      throw new AppError(
        "Not authorized to update this opportunity",
        403,
        null,
        "Only the poster or an admin can make changes"
      );
    }

    const allowedFields = [
      "title",
      "company",
      "location",
      "type",
      "description",
      "deadline",
      "contactInfo",
      "applicationLink",
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body.hasOwnProperty(field)) {
        if (req.body[field] === null) {
          updates[field] = null;
        } else if (typeof req.body[field] === "string") {
          updates[field] = req.body[field].trim();
        } else {
          updates[field] = req.body[field];
        }
      }
    });

    const updated = await Opportunity.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate("postedBy", "name email")
      .lean();

    res.status(200).json({
      success: true,
      message: "Opportunity updated successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete opportunity
// @route   DELETE /api/opportunities/:id
// @access  Private
const deleteOpportunity = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!validateObjectId(id)) {
      throw new AppError("Invalid opportunity ID format", 400);
    }

    const opportunity = await Opportunity.findById(id);

    if (!opportunity) {
      throw new AppError("Opportunity not found", 404);
    }

    if (!checkOwnership(opportunity, req.user)) {
      throw new AppError(
        "Not authorized to delete this opportunity",
        403,
        null,
        "Only the poster or an admin can remove this"
      );
    }

    await Opportunity.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Opportunity removed successfully",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllOpportunities,
  getOpportunityById,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
};