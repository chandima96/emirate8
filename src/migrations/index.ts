import * as migration_20261026_000002_listing_fields from './20261026_000002_listing_fields';
import * as migration_20261027_135539_upgrade_payload_3_90_security_fields from './20261027_135539_upgrade_payload_3_90_security_fields';
import * as migration_20261020_012245_init from './20261020_012245_init';
import * as migration_20261020_024011 from './20261020_024011';
import * as migration_20261020_025344 from './20261020_025344';
import * as migration_20261020_031317 from './20261020_031317';
import * as migration_20261021_000000_control_room from './20261021_000000_control_room';
import * as migration_20261021_120000_control_staff_roles from './20261021_120000_control_staff_roles';
import * as migration_20261021_130000_property_permit_document from './20261021_130000_property_permit_document';
import * as migration_20261022_000000_developer_agency_platform from './20261022_000000_developer_agency_platform';
import * as migration_20261022_000001_migrate_owners_to_developers from './20261022_000001_migrate_owners_to_developers';
import * as migration_20261026_000000_agency_member_password from './20261026_000000_agency_member_password';
import * as migration_20261026_000001_account_suspension from './20261026_000001_account_suspension';
export const migrations = [
  // Applied after the existing schema migrations below.
  // Applied after the existing schema migrations below.
  {
    up: migration_20261020_012245_init.up,
    down: migration_20261020_012245_init.down,
    name: '20261020_012245_init',
  },
  {
    up: migration_20261020_024011.up,
    down: migration_20261020_024011.down,
    name: '20261020_024011',
  },
  {
    up: migration_20261020_025344.up,
    down: migration_20261020_025344.down,
    name: '20261020_025344',
  },
  {
    up: migration_20261020_031317.up,
    down: migration_20261020_031317.down,
    name: '20261020_031317'
  },
  {
    up: migration_20261021_000000_control_room.up,
    down: migration_20261021_000000_control_room.down,
    name: '20261021_000000_control_room'
  },
  {
    up: migration_20261021_120000_control_staff_roles.up,
    down: migration_20261021_120000_control_staff_roles.down,
    name: '20261021_120000_control_staff_roles'
  },
  {
    up: migration_20261021_130000_property_permit_document.up,
    down: migration_20261021_130000_property_permit_document.down,
    name: '20261021_130000_property_permit_document'
  },
  {
    up: migration_20261022_000000_developer_agency_platform.up,
    down: migration_20261022_000000_developer_agency_platform.down,
    name: '20261022_000000_developer_agency_platform'
  },
  {
    up: migration_20261022_000001_migrate_owners_to_developers.up,
    down: migration_20261022_000001_migrate_owners_to_developers.down,
    name: '20261022_000001_migrate_owners_to_developers'
  },
  {
    up: migration_20261026_000000_agency_member_password.up,
    down: migration_20261026_000000_agency_member_password.down,
    name: '20261026_000000_agency_member_password'
  },
  {
    up: migration_20261026_000001_account_suspension.up,
    down: migration_20261026_000001_account_suspension.down,
    name: '20261026_000001_account_suspension'
  },
  { up: migration_20261026_000002_listing_fields.up, down: migration_20261026_000002_listing_fields.down, name: '20261026_000002_listing_fields' },
  {
    up: migration_20261027_135539_upgrade_payload_3_90_security_fields.up,
    down: migration_20261027_135539_upgrade_payload_3_90_security_fields.down,
    name: '20261027_135539_upgrade_payload_3_90_security_fields'
  },
];
