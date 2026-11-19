import { LandingPage, landingMetadata, type LandingProps } from './landingRoute';

/** Area landing page, e.g. /properties/dubai-marina. */
export const generateMetadata = (props: LandingProps) => landingMetadata(props);

export default function AreaPage(props: LandingProps) {
  return <LandingPage {...props} />;
}
