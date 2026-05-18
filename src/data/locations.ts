export interface LocationData {
    code: string;
    name: string;
}

export interface Country extends LocationData {
    phoneCode: string;
}

export interface State extends LocationData {
    countryCode: string;
}

export interface City extends LocationData {
    stateCode: string;
    countryCode: string;
}

export const COUNTRIES: Country[] = [
    { code: "UAE", name: "UAE", phoneCode: "+971" },
    { code: "IN", name: "India", phoneCode: "+91" },
    { code: "US", name: "USA", phoneCode: "+1" },
];

export const STATES: State[] = [
    // UAE
    { code: "DXB", name: "Dubai", countryCode: "UAE" },
    { code: "AUH", name: "Abu Dhabi", countryCode: "UAE" },
    { code: "SHJ", name: "Sharjah", countryCode: "UAE" },
    // India
    { code: "MH", name: "Maharashtra", countryCode: "IN" },
    { code: "KA", name: "Karnataka", countryCode: "IN" },
    { code: "DL", name: "Delhi", countryCode: "IN" },
    // USA
    { code: "CA", name: "California", countryCode: "US" },
    { code: "NY", name: "New York", countryCode: "US" },
    { code: "TX", name: "Texas", countryCode: "US" },
];

export const CITIES: City[] = [
    // UAE - Dubai
    { code: "DXB_CITY", name: "Dubai City", stateCode: "DXB", countryCode: "UAE" },
    { code: "JLX", name: "Jebel Ali", stateCode: "DXB", countryCode: "UAE" },
    // UAE - Abu Dhabi
    { code: "AUH_CITY", name: "Abu Dhabi City", stateCode: "AUH", countryCode: "UAE" },
    { code: "ALN", name: "Al Ain", stateCode: "AUH", countryCode: "UAE" },
    // India - Maharashtra
    { code: "BOM", name: "Mumbai", stateCode: "MH", countryCode: "IN" },
    { code: "PNQ", name: "Pune", stateCode: "MH", countryCode: "IN" },
    // India - Karnataka
    { code: "BLR", name: "Bengaluru", stateCode: "KA", countryCode: "IN" },
    { code: "MYQ", name: "Mysuru", stateCode: "KA", countryCode: "IN" },
    // USA - California
    { code: "LAX", name: "Los Angeles", stateCode: "CA", countryCode: "US" },
    { code: "SFO", name: "San Francisco", stateCode: "CA", countryCode: "US" },
];
