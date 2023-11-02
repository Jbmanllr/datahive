import axios from "axios";

const DIRECTUS_API_ENDPOINT = "http://0.0.0.0:8055/items";
const DIRECTUS_API_TOKEN = "gf1WRZJD2hDYcI73ZQgXYBBZ1dlbV7zs";

// Constants for error codes
const ERROR_CODES = {
  RECORD_NOT_UNIQUE: "RECORD_NOT_UNIQUE",
  // Add other error codes as needed
};

export async function apiRequest({
  method,
  collection,
  data = null,
  params = null,
  id = null,
  isErrorReport = false,
  run = null,
}) {
  const endpoint = id
    ? `${DIRECTUS_API_ENDPOINT}/${collection}/${id}`
    : `${DIRECTUS_API_ENDPOINT}/${collection}`;

  try {
    const config = {
      method: method,
      url: endpoint,
      headers: {
        Authorization: `Bearer ${DIRECTUS_API_TOKEN}`,
        "Content-Type": "application/json",
      },
    };

    if (method === "GET") {
      config.params = params;
    } else {
      config.data = data;
    }

    const response = await axios(config);

    if (method === "POST") {
      console.log(
        `${isErrorReport ? "ERROR" : "DATA"} SENT SUCCESSFULLY: ${
          response.data?.data?.id
        }`
      );
    }

    return response.data;
  } catch (error) {
    if (error.response && error.response.data && error.response.data.errors) {
      for (const err of error.response.data.errors) {
        if (!isErrorReport) {
          let errorCode = err.extensions.code;
          let reportType = determineReportType(errorCode);
          try {
            await apiRequest({
              method: "POST",
              collection: "data_factory_migrations_report",
              data: {
                type: reportType,
                item_id: data.raw_data_id,
                run_id: run.data.id,
                code: errorCode,
                message: err.message,
                raw_data: error,
              },
              isErrorReport: true,
            });
          } catch (error) {
            console.log("ERROR SENDING ERROR:", error.message);
          }
        }

        console.error(
          `ERROR: "${err.extensions.code}" ${method} DATA TO DIRECTUS FOR "${data.url}": ${err.message}`
        );
      }
    } else {
      console.error(
        `Error ${method} data to Directus for ${data ? data.url : ""}:`,
        error.message
      );
    }
  }
}

// Function to determine the report type based on the error code
function determineReportType(errorCode) {
  switch (errorCode) {
    case ERROR_CODES.RECORD_NOT_UNIQUE:
      // This error code is expected in certain scenarios, log as info
      return "info";
    // Add other cases as needed
    default:
      // For all other error codes, log as error
      return "error";
  }
}
