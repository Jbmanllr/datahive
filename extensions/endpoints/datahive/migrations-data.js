import {
  getSlug,
  slugToName,
  removeRootUrl,
  extractUsageFromContext,
} from "./utils.js";

export const ENTITY_TABLES = {
  submission: "eb_rep_submissions",
  pro: "eb_rep_pros",
  item: "eb_rep_items",
  brand: "eb_rep_brands",
  band: "eb_rep_bands",
  category: "eb_rep_categories",
  role: "eb_rep_roles",
  genre: "eb_rep_genres",
  review: "eb_rep_reviews",
  social_link: "eb_rep_social_links",
};

export const TRANSFORM_FUNCTIONS = {
  removeRootUrl: (value) => removeRootUrl(value),
  slugToNameIfEmpty: (value, data) =>
    value ? value : slugToName(getSlug(data.url)),
  integer: (value) => (value && value !== "N/A" ? value : null),
  extractUsageFromContext: (value) => extractUsageFromContext(value),
  inferMissingValue: (value) => value == null,
};

export const TRANSFORM_MAPPINGS = {
  submission: {
    url: "occurrence_path",
    nice_url: { field: "occurrence_nice_url", transform: "removeRootUrl" },
    pro_urlr: "pro",
    item_url: "item",
    source_url: "source_url",
    source_img: "source_img",
    supported_via: "supported_via",
    description: "description",
    context: { field: "context", transform: "extractUsageFromContext" },
    verification_status: "status",
    nb_upvotes: "upvotes",
    nb_comments: "comment_nb",
    submission_id: "occurrence_id",
  },
  pro: {
    url: { field: "url", transform: "removeRootUrl" },
    name: { field: "name", transform: "slugToNameIfEmpty" },
    bands_json: "groups",
    genres_json: "genres",
    roles_json: "roles",
    social_links_json: "social_links",
    nb_occurrences: "nb_occurrences",
    nb_followers: "followersCount",
    nb_contributors: "contributorsCount",
    img_src: "image_src",
    meta_title: "meta_title",
    meta_description: "meta_description",
  },
  item: {
    url: { field: "url", transform: "removeRootUrl" },
    name: { field: "name", transform: "slugToNameIfEmpty" },
    brand_url: "brand_url",
    description: "description",
    buy_links_json: "links",
    similar_json: "similar",
    is_stub: { field: "name", transform: "inferMissingValue" },
    last_category: "last_category",
    categories_json: "categories",
    reviews_json: "reviews",
    rating: {
      field: "rating",
      transform: "integer",
    },
    nb_ratings: {
      field: "nb_ratings",
      transform: "integer",
    },
    eb_score: {
      field: "eb_score",
      transform: "integer",
    },
    img_src: "img_src",
    consensus: "consensus",
    meta_title: "meta_title",
    meta_description: "meta_description",
    meta_robot: "meta_robot",
  },
  brand: {
    url: { field: "url", transform: "removeRootUrl" },
    name: { field: "name", transform: "slugToNameIfEmpty" },
  },
  band: {
    url: { field: "url", transform: "removeRootUrl" },
    name: { field: "name", transform: "slugToNameIfEmpty" },
  },
};
