import axios, { AxiosRequestConfig } from "axios";
import { ApiRequestOptions } from "../types"

export async function apiRequest({
  method,
  collection,
  data = null,
  params = null,
  id,
  isErrorReport = false,
  run,
  fields = "",
}: ApiRequestOptions): Promise<any> {
  const endpoint = id
    ? `${process.env.DIRECTUS_API_BASE_URL}/items/${collection}/${id}${fields}`
    : `${process.env.DIRECTUS_API_BASE_URL}/items/${collection}`;

  try {
    const config: AxiosRequestConfig = {
      method: method,
      url: endpoint,
      headers: {
        Authorization: `Bearer ${process.env.DIRECTUS_API_TOKEN}`,
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
      //console.log(
      //  `${isErrorReport ? "Error" : "Data"} successfully added to ${collection} :D ! Entry ID ${response.data.data.id}`
      //);
    }

    if (method === "PATCH") {
      //console.log(
      //  `${collection}'s entry ID ${response.data.data.id} updated successfully :D !`
      //);
    }

    return response.data;
  } catch (error: any) {
    if (error.response && error.response.data && error.response.data.errors) {
      for (const err of error.response.data.errors) {
        if (!isErrorReport) {
          try {
            await apiRequest({
              method: "POST",
              collection: "databee_run_reports",
              data: {
                type: "info",
                run_id: run?.data.id,
                item_id: data?.raw_data_id,
                code: err.extensions.code,
                message: err.message,
                raw_data: error,
              },
              isErrorReport: true,
            });
          } catch (error: any) {
            console.log("ERROR SENDING ERROR:", error.message);
          }
        }

        console.error(
          `ERROR: "${err.extensions.code}" ${method} DATA TO DIRECTUS FOR "${data?.url}": ${err.message}`
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
