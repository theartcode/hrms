import { API_ENDPOINTS } from "@/constants/api-endpoints";
import { createReferenceDataService } from "./reference-data.service";

export const locationService = createReferenceDataService(
  API_ENDPOINTS.LOCATIONS,
  "locations",
  "location"
);
