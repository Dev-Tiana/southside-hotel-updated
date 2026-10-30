export type VerificationState = "verified" | "provisional" | "awaiting approval";

export const hotelProfile = {
  name: "SouthSide Hotel and Suites",
  location: "Winners Street, Abraka, Delta State, Nigeria",
  phone: "+234 705 562 8339",
  email: "Hotelsouthside@gmail.com",
  timezone: "Africa/Lagos",
  currency: "NGN",
  verification: "verified" as VerificationState,
  social: {
    instagram: "https://www.instagram.com/southside_hotel/?hl=en",
    tiktok: "https://www.tiktok.com/@southside.hotel.abraka",
    website: "https://www.southsidehotelandsuites.com/",
    maps: "https://www.google.com/maps/search/SouthSide+Hotel+and+Suites+Abraka+Delta+State+Nigeria",
    snapchat: "https://www.snapchat.com/place/southsidehotelandsuitesabraka/daf89268-aa35-11f0-aa3d-171979d6f4a6",
    whatsapp: "https://wa.me/2347055628339?text=Hello%20SouthSide%20Hotel%20and%20Suites.%20I%20would%20like%20to%20make%20an%20enquiry%20about%20accommodation.",
  },
};

export const hotelMedia = [
  { src: "/manus-storage/southside-hotel_4ed40881.jpg", alt: "SouthSide Hotel and Suites glowing at night in Abraka", label: "SouthSide after dark", detail: "", source: "https://www.instagram.com/reel/C8W5KW8Nw4E/", variant: "ink" as const },
  { src: "/manus-storage/southside-stay_ce1215c9.jpg", alt: "SouthSide interior with artwork and a television", label: "A room to settle into", detail: "", source: "https://www.instagram.com/p/DX-SphpDfKG/", variant: "moss" as const },
  { src: "/manus-storage/southside-tour_c1a0bee6.jpg", alt: "SouthSide Hotel and Suites exterior in Abraka", label: "The SouthSide arrival", detail: "", source: "https://www.instagram.com/reel/DMfVzISNlkD/", variant: "copper" as const },
  { src: "/manus-storage/southside-classic_e037045c.jpg", alt: "SouthSide bathroom with a rainfall shower", label: "Room details", detail: "", source: "https://www.instagram.com/reel/DdFP69HtWUR/", variant: "moss" as const },
] as const;

const representative = {
  classic: { image: "/manus-storage/async-images/h4VsiYI2qsri3oj3gNW8em/image-1.webp", imageAlt: "Classic Room interior" , imageDetail: "" },
  royal: { image: "/manus-storage/async-images/WjRAYLaGwe6HRgK4pCqLMI/image-1.webp", imageAlt: "Royal Suite interior", imageDetail: "" },
  superior: { image: "/manus-storage/async-images/WjRAYLaGwe6HRgK4pCqLMI/image-2.webp", imageAlt: "Superior Suite interior", imageDetail: "" },
  luxury205: { image: "/manus-storage/async-images/WjRAYLaGwe6HRgK4pCqLMI/image-3.webp", imageAlt: "Luxury Room 205 interior", imageDetail: "" },
  luxury208: { image: "/manus-storage/async-images/WjRAYLaGwe6HRgK4pCqLMI/image-4.webp", imageAlt: "Luxury Room 208 interior", imageDetail: "" },
  premium306: { image: "/manus-storage/async-images/WjRAYLaGwe6HRgK4pCqLMI/image-5.webp", imageAlt: "Premium Room 306 interior", imageDetail: "" },
  premium308: { image: "/manus-storage/async-images/X72BhlloLAVs2FvW5msYBR/image-1.webp", imageAlt: "Premium Room 308 interior", imageDetail: "" },
  executive: { image: "/manus-storage/async-images/X72BhlloLAVs2FvW5msYBR/image-2.webp", imageAlt: "Executive Accommodation interior", imageDetail: "" },
} as const;

export const provisionalRooms = [
  { slug: "classic-room", name: "Classic Room", lead: "A calm room for an easy stay in Abraka.", description: "The Classic Room is the practical starting point for a SouthSide stay. The public guide rate is drawn from indexed hotel content and should be reconfirmed for your dates.", amount: 55000, evidence: "Indexed SouthSide room page and official classic-room social content", verification: "provisional" as VerificationState, ...representative.classic, amenities: ["Comfortable room setting", "Room arrangement to confirm with the hotel", "Direct hotel enquiry"] },
  { slug: "royal-suite", name: "Royal Suite", lead: "More space for longer visits and slower mornings.", description: "The Royal Suite is presented in the public SouthSide catalogue as a more generous stay. Ask the hotel to confirm the current arrangement and rate.", amount: 65000, evidence: "Indexed SouthSide room catalogue reference", verification: "provisional" as VerificationState, ...representative.royal, amenities: ["Suite setting", "Current inclusions to confirm", "Direct hotel enquiry"] },
  { slug: "superior-suite", name: "Superior Suite", lead: "A suite choice for guests who want a little more room.", description: "The Superior Suite gives guests another way to shape a SouthSide stay. The public guide rate is a lead for confirmation, not a guaranteed quote.", amount: 65000, evidence: "Indexed SouthSide room catalogue reference", verification: "provisional" as VerificationState, ...representative.superior, amenities: ["Suite setting", "Room details by direct enquiry", "Guide rate requires confirmation"] },
  { slug: "luxury-room-205", name: "Luxury Room 205", lead: "A refined room choice for a focused stay.", description: "Luxury Room 205 is part of the indexed SouthSide room catalogue. Contact the hotel for current room details, rate, and availability.", amount: 75000, evidence: "Indexed SouthSide room page", verification: "provisional" as VerificationState, ...representative.luxury205, amenities: ["Refined room setting", "Room details by direct enquiry", "Guide rate requires confirmation"] },
  { slug: "luxury-room-208", name: "Luxury Room 208", lead: "A polished room for evenings in Abraka.", description: "Luxury Room 208 is a SouthSide room choice for guests looking for a polished base in Abraka. Ask the hotel to confirm the public guide rate for your dates.", amount: 75000, evidence: "Indexed SouthSide room page", verification: "provisional" as VerificationState, ...representative.luxury208, amenities: ["Refined room setting", "Direct hotel enquiry", "Guide rate requires confirmation"] },
  { slug: "premium-room-306", name: "Premium Room 306", lead: "A premium room for guests who value a composed stay.", description: "Premium Room 306 offers another SouthSide accommodation choice for business, event, and personal visits. Contact the hotel for the current room arrangement and rate.", amount: 95000, evidence: "Indexed SouthSide room catalogue reference", verification: "provisional" as VerificationState, ...representative.premium306, amenities: ["Premium room setting", "Direct hotel enquiry", "Guide rate requires confirmation"] },
  { slug: "premium-room-308", name: "Premium Room 308", lead: "A premium room for a more considered visit.", description: "Premium Room 308 is part of the SouthSide catalogue for guests planning time in Abraka. Ask the hotel for current room details, rate, and availability.", amount: 95000, evidence: "Indexed SouthSide room catalogue reference", verification: "provisional" as VerificationState, ...representative.premium308, amenities: ["Premium room setting", "Direct hotel enquiry", "Guide rate requires confirmation"] },
  { slug: "executive-accommodation", name: "Executive Accommodation", lead: "A comfortable base for work and longer days.", description: "Executive Accommodation is designed for guests who want a practical SouthSide base while work or an event fills the day. Call the hotel for the current arrangement and rate.", amount: 105000, evidence: "Indexed SouthSide room catalogue reference", verification: "provisional" as VerificationState, ...representative.executive, amenities: ["Executive stay setting", "Direct hotel enquiry", "Guide rate requires confirmation"] },
] as const;

export const facilityLeads = [
  { title: "Reception and arrival", copy: "Begin your stay with a direct welcome and a clear route to your room." },
  { title: "Gym", copy: "The hotel presents a gym in its official social content. Ask the team about equipment and access during your stay." },
  { title: "Food and dining", copy: "Food and kitchen scenes feature in official SouthSide content. Ask the hotel about the current dining format." },
  { title: "Lounge", copy: "A lounge atmosphere is part of the SouthSide story. Ask the hotel about current hours and guest access." },
  { title: "Events", copy: "SouthSide shares event-related scenes for guests planning gatherings. Speak with the hotel about the available setting." },
  { title: "Rooms and suites", copy: "Choose from a catalogue of rooms and suites, then speak with the hotel about the right fit for your dates." },
];

export const destinationLeads = [
  { name: "McCarthy Beach", status: "Plausible local lead", copy: "A public Delta State tourism reference names McCarthy Beach in Abraka. Confirm access, safety, opening arrangements, and current condition locally before visiting.", source: "https://www.facebook.com/DSGovernment/videos/delta-state-continues-to-highlight-its-natural-attractions-as-part-of-a-broader/1885024915428204/" },
  { name: "River Ethiope", status: "Regional nature lead", copy: "River Ethiope is widely described in public travel and academic references as a Delta State natural feature associated with communities around Abraka. Ask the hotel for current local guidance rather than relying on an unverified distance or itinerary.", source: "https://www.worldscholars.org/index.php/jss/article/view/528" },
  { name: "Abraka and DELSU", status: "Local context", copy: "Abraka is home to Delta State University’s Abraka campus. Use the hotel as a base for local visits, and ask the team for current directions and event-day advice.", source: "https://www.delsu.edu.ng/" },
  { name: "Park Vega Waterpark", status: "Day-trip lead", copy: "Park Vega is publicly promoted in Delta State travel content in Agbor. It is not in Abraka, so confirm travel time, operating dates, and tickets independently before planning a visit.", source: "https://www.tripadvisor.com/Attractions-g3652170-Activities-c42-Delta_State.html" },
];

export const attributedReviews = [
  { quote: "Nice place to visit", author: "Guest reviewer", age: "3 weeks ago", source: "Wanderboat", url: "https://wanderboat.ai/hotels/nigeria/delta-state/southside-hotel-and-suites-abraka/nGMoPYm-TRmYayeo4URfVw" },
  { quote: "The receptionist are nice, thier services are top notch... Will love to visit again", author: "Guest reviewer", age: "2 years ago", source: "Wanderboat", url: "https://wanderboat.ai/hotels/nigeria/delta-state/southside-hotel-and-suites-abraka/nGMoPYm-TRmYayeo4URfVw" },
  { quote: "They have Cool room, a nice restaurant, a nice bathroom and so many others", author: "Guest reviewer", age: "25 weeks ago", source: "Wanderboat", url: "https://wanderboat.ai/hotels/nigeria/delta-state/southside-hotel-and-suites-abraka/nGMoPYm-TRmYayeo4URfVw" },
];

export const publicSourceLinks = [
  { label: "SouthSide Instagram", url: hotelProfile.social.instagram, note: "The official-looking social channel with room, arrival, food, and stay content." },
  { label: "SouthSide TikTok", url: hotelProfile.social.tiktok, note: "A hotel-branded account with tours and room content from Abraka." },
  { label: "Google Maps listing", url: hotelProfile.social.maps, note: "A route and place reference for guests; ratings and user media can change." },
  { label: "SouthSide website", url: hotelProfile.social.website, note: "The hotel web address used in public listings; confirm live details with the hotel." },
];

export const faqItems = [
  { question: "Where is SouthSide Hotel and Suites located?", answer: "SouthSide Hotel and Suites is on Winners Street in Abraka, Delta State, Nigeria. Call the hotel for the best directions from your starting point." },
  { question: "How can I make a reservation?", answer: "Use the booking page to begin with your dates, guests, and preferred room. You can also call or WhatsApp the hotel for a direct enquiry." },
  { question: "What are the public room rates?", answer: "The catalogue shows public guide rates from indexed hotel content. Contact the hotel to confirm the current rate for your dates before you travel." },
  { question: "What facilities are available?", answer: "SouthSide presents reception, rooms, a gym, lounge, food, and event-related spaces. Ask the hotel about current access, hours, and arrangements." },
  { question: "What are the check-in and check-out times?", answer: "Call the hotel before your arrival for the current check-in and check-out times." },
  { question: "What payment methods are accepted?", answer: "Ask the hotel which payment method is best for your reservation and dates." },
];

export const pendingApprovals = [
  "Confirm the current room catalogue, guide rates, and inventory before selling online.",
  "Confirm street wording, guest policies, and arrival details.",
  "Confirm written permission for each hotel-supplied social image before launch.",
  "Confirm payment, email, and notification credentials and test them end to end.",
];
