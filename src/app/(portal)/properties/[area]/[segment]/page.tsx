import { LandingPage, landingMetadata, type LandingProps } from '../landingRoute';

/** Area + type + purpose landing page, e.g. /properties/dubai-marina/apartments-for-sale. */
export const generateMetadata = (props: LandingProps) => landingMetadata(props);

export default function AreaSegmentPage(props: LandingProps) {
  return <LandingPage {...props} />;
}
