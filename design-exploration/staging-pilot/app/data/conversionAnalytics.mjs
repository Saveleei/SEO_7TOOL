const ALLOWED_EVENTS = new Set([
  "PHONE_CLICK", "EMAIL_CLICK", "click_messenger", "homepage_action",
  "catalog_navigation", "category_listing_action",
  "view_category", "apply_filter", "open_product", "view_product",
  "add_to_quote", "remove_from_quote", "change_quote_quantity", "open_quote", "submit_quote", "quote_success", "quote_error",
  "open_quick_order", "submit_quick_order", "quick_order_success", "quick_order_error",
  "open_variant_list", "close_variant_list", "select_variant", "open_comparison",
  "comparison_view", "comparison_add", "comparison_remove", "comparison_clear", "comparison_add_to_quote", "comparison_open_product",
  "search_submit", "search_select", "search_zero_action", "search_all_results", "search_guided_selection",
  "open_selection_contact", "show_task_direction", "show_analog_path", "select_specification_file",
  "submit_selection_request", "selection_request_success", "selection_request_error",
  "web_vital",
]);

const SAFE_STRING_FIELDS = new Set([
  "event", "placement", "page_type", "product_id", "variant_id", "category", "channel", "action",
  "request_type", "quick_order_mode", "filter_name", "filter_kind", "result_type", "query_type",
  "target_product_id", "target_variant_id",
  "metric_name", "metric_rating", "navigation_type",
]);
const SAFE_NUMBER_FIELDS = new Set(["item_count", "candidate_count", "result_count", "result_position", "query_length", "active_filter_count", "metric_value", "metric_delta"]);
const SAFE_VALUE = /^[\p{L}\p{N}_.:+-]+(?:[ ]+[\p{L}\p{N}_.:+-]+){0,7}$/u;

export function sanitizeConversionEvent(value) {
  if (!value || typeof value !== "object") return null;
  const event = sanitizeString(value.event);
  if (!event || !ALLOWED_EVENTS.has(event)) return null;
  const sanitized = { event };
  for (const [key, fieldValue] of Object.entries(value)) {
    if (key === "event") continue;
    if (SAFE_STRING_FIELDS.has(key)) {
      const normalized = sanitizeString(fieldValue);
      if (normalized) sanitized[key] = normalized;
      continue;
    }
    if (SAFE_NUMBER_FIELDS.has(key)) {
      const number = Number(fieldValue);
      if (Number.isFinite(number) && number >= 0 && number <= 1_000_000) sanitized[key] = number;
    }
  }
  return sanitized;
}

function sanitizeString(value) {
  const normalized = String(value ?? "").trim().slice(0, 120);
  return SAFE_VALUE.test(normalized) ? normalized : "";
}

