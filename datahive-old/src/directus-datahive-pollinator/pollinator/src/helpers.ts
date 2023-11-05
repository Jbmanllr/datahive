import axios, { AxiosRequestConfig, Method } from "axios";

const DIRECTUS_API_ENDPOINT = "http://0.0.0.0:8055/items";
const DIRECTUS_API_TOKEN = "gf1WRZJD2hDYcI73ZQgXYBBZ1dlbV7zs";

// Constants for error codes
const ERROR_CODES = {
  RECORD_NOT_UNIQUE: "RECORD_NOT_UNIQUE",
  // Add other error codes as needed
} as const;

type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

interface ApiRequestParams {
  method: Method;
  collection: string;
  data?: any; // Replace `any` with the actual expected data type
  params?: any; // Replace `any` with the actual expected params type
  id?: string | number;
  isErrorReport: boolean;
  run?: {
    data: {
      id: string;
    };
  };
}

interface ErrorDetail {
  message: string;
  extensions: {
    code: ErrorCode;
  };
}

interface ErrorResponse {
  response: {
    data: {
      errors: ErrorDetail[];
    };
  };
}

export async function apiRequest({
  method,
  collection,
  data = null,
  params = null,
  //@ts-ignore
  id = null,
  isErrorReport = false,
  //@ts-ignore
  run = null,
}: ApiRequestParams): Promise<any> { // Replace `any` with the actual expected return type
  const endpoint = id
    ? `${DIRECTUS_API_ENDPOINT}/${collection}/${id}`
    : `${DIRECTUS_API_ENDPOINT}/${collection}`;

  const config: AxiosRequestConfig = {
    method: method,
    url: endpoint,
    headers: {
      Authorization: `Bearer ${DIRECTUS_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    ...(method === "GET" ? { params } : { data }),
  };

  try {
    const response = await axios(config);

    if (method === "POST") {
      console.log(
        `${isErrorReport ? "ERROR" : "DATA"} SENT SUCCESSFULLY: ${
          response.data?.data?.id
        }`
      );
    }

    return response.data;
  } catch (error: any) {
    const err = error as ErrorResponse;
    if (err.response && err.response.data && err.response.data.errors) {
      for (const errorDetail of err.response.data.errors) {
        if (!isErrorReport) {
          let errorCode = errorDetail.extensions.code;
          let reportType = determineReportType(errorCode);
          try {
            await apiRequest({
              method: "POST",
              collection: "data_factory_migrations_report",
              data: {
                type: reportType,
                item_id: data?.raw_data_id,
                run_id: run?.data.id,
                code: errorCode,
                message: errorDetail.message,
                raw_data: error,
              },
              isErrorReport: true,
            });
          } catch (error : any) {
            console.log("ERROR SENDING ERROR:", error.message);
          }
        }

        console.error(
          `ERROR: "${errorDetail.extensions.code}" ${method} DATA TO DIRECTUS FOR "${data?.url}": ${errorDetail.message}`
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
function determineReportType(errorCode: ErrorCode): "info" | "error" {
  switch (errorCode) {
    case ERROR_CODES.RECORD_NOT_UNIQUE:
      return "info";
    // Add other cases as needed
    default:
      return "error";
  }
}
