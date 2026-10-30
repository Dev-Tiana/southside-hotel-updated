import StaffLogin from "./pages/StaffLogin";
import Payment from "./pages/Payment";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useEffect } from "react";
import Home from "./pages/Home";
import Accommodation from "./pages/Accommodation";
import RoomDetail from "./pages/RoomDetail";
import Contact from "./pages/Contact";
import Admin from "./pages/Admin";
import { Booking, BookingConfirmation } from "./pages/Booking";
import BookingManage from "./pages/BookingManage";
import { About, Discover, FAQ, Facilities, Gallery, Offers, Policies } from "./pages/ContentPages";

function PageMeta({ title, description }: { title: string; description: string }) {
  useEffect(() => {
    document.title = `${title} | SouthSide Hotel and Suites`;
    const descriptionTag = document.querySelector('meta[name="description"]') || document.head.appendChild(Object.assign(document.createElement("meta"), { name: "description" }));
    descriptionTag.setAttribute("content", description);
  }, [title, description]);
  return null;
}

function HomeRoute() { return <><PageMeta title="A considered stay in Abraka" description="SouthSide Hotel and Suites in Abraka, with rooms, spaces, official hotel photography, direct WhatsApp contact, and a clear booking path." /><Home /></>; }
function AccommodationRoute() { return <><PageMeta title="Rooms and suites" description="Explore rooms and suites at SouthSide Hotel and Suites in Abraka, with public guide rates and direct hotel contact." /><Accommodation /></>; }
function RoomRoute() { return <><PageMeta title="Room details" description="Explore a SouthSide room in Abraka, see official hotel imagery, and ask the team about dates and rates." /><RoomDetail /></>; }
function ContactRoute() { return <><PageMeta title="Contact SouthSide Hotel" description="Contact SouthSide Hotel and Suites in Abraka by telephone, email, WhatsApp, or enquiry form." /><Contact /></>; }
function BookingRoute() { return <><PageMeta title="Book a room" description="Choose dates, guests, and a preferred room for a SouthSide Hotel and Suites stay in Abraka." /><Booking /></>; }
function ManageBookingRoute() { return <><PageMeta title="Change a booking request" description="Send SouthSide Hotel and Suites a cancellation or modification request by reservation reference." /><BookingManage /></>; }
function DiscoverRoute() { return <><PageMeta title="Abraka guide" description="Public destination leads and local context for guests staying at SouthSide Hotel and Suites in Abraka." /><Discover /></>; }

function Router() {
  return <Switch>
    <Route path="/" component={HomeRoute} />
    <Route path="/accommodation" component={AccommodationRoute} />
    <Route path="/rooms/:slug" component={RoomRoute} />
    <Route path="/facilities" component={Facilities} />
    <Route path="/gallery" component={Gallery} />
    <Route path="/about" component={About} />
    <Route path="/discover" component={DiscoverRoute} />
    <Route path="/contact" component={ContactRoute} />
    <Route path="/offers" component={Offers} />
    <Route path="/faq" component={FAQ} />
    <Route path="/policies" component={Policies} />
    <Route path="/booking" component={BookingRoute} />
    <Route path="/payment" component={Payment}/>
    <Route path="/payment/mock" component={Payment}/>
    <Route path="/payment/return" component={Payment}/>
    <Route path="/booking/confirmation" component={BookingConfirmation} />
    <Route path="/booking/manage" component={ManageBookingRoute} />
    <Route path="/staff/login" component={StaffLogin} />
    <Route path="/admin" component={Admin} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
