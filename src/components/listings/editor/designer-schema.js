// Field definitions and pure validation/pricing adapted from the supplied listing reference.
// Deliberately excludes its demo catalogue, profile, storage and submission services.
const E08 = {};
/* EMIRATE08 — Create a listing
 * config.js — configuration, limits and shared formatting/parsing helpers.
 * All files attach to window.E08 so the project runs from file:// without a build step.
 */
(function () {
  'use strict';

  var MB = 1024 * 1024;

  E08.config = {
    SCHEMA_VERSION: 1,
    STORE_PREFIX: 'e08.listingDraft.',
    CURRENT_KEY: 'e08.listingDraft.current',
    AUTOSAVE_MS: 1200,
    SQM_PER_SQFT: 0.09290304,
    // Example limits — keep in sync with server-side validation (the server is the authority).
    LIMITS: {
      photos: {
        max: 30,
        maxBytes: 15 * MB,
        types: ['image/jpeg', 'image/png', 'image/webp'],
        recommendMin: 8,
        recommendMax: 15,
        lowW: 1280,
        lowH: 720,
      },
      videos: { max: 3, maxBytes: 200 * MB, types: ['video/mp4', 'video/webm'] },
      links: { max: 5 },
      plans: { max: 10, maxBytes: 20 * MB, types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] },
      brochure: { maxBytes: 25 * MB, types: ['application/pdf'] },
      poster: { maxBytes: 5 * MB, types: ['image/jpeg', 'image/png', 'image/webp'] },
      subtitle: { maxBytes: 1 * MB, exts: ['vtt', 'srt'] },
      privateDoc: { maxBytes: 10 * MB, types: ['application/pdf', 'image/jpeg', 'image/png'] },
    },
  };

  var U = (E08.util = {});
  var now = new Date();
  U.CUR_YEAR = now.getFullYear();
  U.CUR_Q = Math.floor(now.getMonth() / 3) + 1;
  U.UNIT_L = { sqft: 'sq ft', sqm: 'sq m' };

  /** Escape any user-provided text before it goes into HTML. */
  U.h = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };
  U.uid = function (p) {
    return (p || 'id') + '-' + Math.random().toString(36).slice(2, 10);
  };
  U.trim1 = function (s) {
    return String(s == null ? '' : s)
      .replace(/\s+/g, ' ')
      .trim();
  };
  U.norm = function (s) {
    return String(s || '')
      .toLowerCase()
      .trim();
  };
  U.isBlank = function (v) {
    if (v == null) return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'object') return U.isBlank(v.raw);
    if (typeof v === 'boolean') return false;
    return String(v).trim() === '';
  };
  U.range = function (a, b) {
    var r = [];
    for (var i = a; i <= b; i++) r.push(i);
    return r;
  };

  /* ---- Money: integer fils (1 AED = 100 fils) — never floats for money ---- */
  U.parseMoney = function (s) {
    s = String(s == null ? '' : s)
      .replace(/[,\s]/g, '')
      .replace(/^AED/i, '');
    if (s === '') return null;
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
    var p = s.split('.');
    return Number(p[0]) * 100 + Number(((p[1] || '') + '00').slice(0, 2));
  };
  U.filsToDec = function (f) {
    return Math.floor(f / 100) + '.' + String(f % 100).padStart(2, '0');
  };
  U.fmtAED = function (f) {
    if (f == null || isNaN(f)) return '—';
    var neg = f < 0;
    f = Math.abs(f);
    var i = Math.floor(f / 100),
      c = f % 100;
    return (neg ? '−' : '') + 'AED ' + i.toLocaleString('en-US') + (c ? '.' + String(c).padStart(2, '0') : '');
  };
  /* Percentages as integer basis points (1% = 100 bp) */
  U.parsePct = function (s) {
    s = String(s == null ? '' : s).replace(/[%\s]/g, '');
    if (s === '') return null;
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
    var p = s.split('.');
    return Number(p[0]) * 100 + Number(((p[1] || '') + '00').slice(0, 2));
  };
  U.pctOf = function (fils, bp) {
    return Math.round((fils * bp) / 10000);
  };
  U.fmtBp = function (bp) {
    return (bp / 100).toLocaleString('en-US', { maximumFractionDigits: 2 }) + '%';
  };
  U.parseIntSafe = function (s) {
    s = String(s == null ? '' : s).trim();
    if (s === '') return null;
    if (!/^\d+$/.test(s)) return NaN;
    return Number(s);
  };
  U.parseDec = function (s) {
    s = String(s == null ? '' : s)
      .replace(/,/g, '')
      .trim();
    if (s === '') return null;
    if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
    return Number(s);
  };
  U.fmtNum = function (n, dp) {
    return Number(n).toLocaleString('en-US', { maximumFractionDigits: dp == null ? 2 : dp });
  };

  /* ---- Dates (ISO yyyy-mm-dd strings compare lexicographically) ---- */
  U.validDate = function (s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
    var p = s.split('-').map(Number),
      d = new Date(p[0], p[1] - 1, p[2]);
    return d.getFullYear() === p[0] && d.getMonth() === p[1] - 1 && d.getDate() === p[2];
  };
  U.todayISO = function () {
    var d = new Date();
    return (
      d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    );
  };
  U.fmtDate = function (s) {
    if (!U.validDate(s)) return s || '';
    var p = s.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };
  U.quarterOf = function (iso) {
    return Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1;
  };

  U.fmtBytes = function (b) {
    if (b == null) return '';
    if (b < 1024) return b + ' B';
    if (b < MB) return Math.round(b / 1024) + ' KB';
    return (b / MB).toFixed(1) + ' MB';
  };
  U.fmtDur = function (s) {
    if (!isFinite(s)) return '';
    s = Math.round(s);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };

  /* ---- Area: entered value is canonical {raw, unit}; conversions are display-only ---- */
  U.areaIn = function (v, unit) {
    if (!v || U.isBlank(v.raw)) return null;
    var n = U.parseDec(v.raw);
    if (n == null || isNaN(n)) return NaN;
    if (v.unit === unit) return n;
    var k = E08.config.SQM_PER_SQFT;
    return v.unit === 'sqft' ? n * k : n / k;
  };

  /* Contact details, links or messaging handles in marketing copy */
  U.CONTACT_RE =
    /(\+?\d[\d\s\-().]{7,}\d)|([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})|(https?:\/\/|www\.)|(\bwhats\s?app\b)|(\btelegram\b)/i;

  /** https-only URL check; returns URL object or null */
  U.safeHttpsUrl = function (raw) {
    try {
      var u = new URL(String(raw).trim());
      return u.protocol === 'https:' ? u : null;
    } catch (e) {
      return null;
    }
  };

  /** Recognised video providers only. Never embeds arbitrary HTML. */
  U.parseVideoUrl = function (raw) {
    var u;
    try {
      u = new URL(String(raw).trim());
    } catch (e) {
      return null;
    }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    var host = u.hostname.replace(/^(www\.|m\.)/, ''),
      id = null,
      m;
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else if ((m = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]{11})/))) id = m[2];
      if (id && /^[\w-]{11}$/.test(id))
        return {
          provider: 'YouTube',
          id: id,
          href: 'https://www.youtube.com/watch?v=' + id,
          embed: 'https://www.youtube-nocookie.com/embed/' + id,
        };
      return null;
    }
    if (host === 'youtu.be') {
      id = u.pathname.slice(1).split('/')[0];
      return /^[\w-]{11}$/.test(id)
        ? {
            provider: 'YouTube',
            id: id,
            href: 'https://www.youtube.com/watch?v=' + id,
            embed: 'https://www.youtube-nocookie.com/embed/' + id,
          }
        : null;
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      m = u.pathname.match(/^\/(?:video\/)?(\d{6,12})(?:\/|$)/);
      return m
        ? {
            provider: 'Vimeo',
            id: m[1],
            href: 'https://vimeo.com/' + m[1],
            embed: 'https://player.vimeo.com/video/' + m[1],
          }
        : null;
    }
    return null;
  };

  /** Recognised virtual-tour providers. Link fallback only — no arbitrary embed code. */
  U.parseTourUrl = function (raw) {
    var u = U.safeHttpsUrl(raw);
    if (!u) return null;
    var host = u.hostname.replace(/^www\./, '');
    if (
      host === 'my.matterport.com' &&
      /^\/show\/?$/.test(u.pathname) &&
      /^[A-Za-z0-9]{6,}$/.test(u.searchParams.get('m') || '')
    ) {
      return { provider: 'Matterport', href: 'https://my.matterport.com/show/?m=' + u.searchParams.get('m') };
    }
    if (host === 'kuula.co' && /^\/(share|post)\/[A-Za-z0-9]+/.test(u.pathname)) {
      return { provider: 'Kuula', href: 'https://kuula.co' + u.pathname };
    }
    return null;
  };

  /** Inline Bootstrap Icon */
  U.icon = function (name, cls) {
    return '<i class="bi bi-' + name + (cls ? ' ' + cls : '') + '" aria-hidden="true"></i>';
  };
})();

/* catalog.js — property types, amenities and the SAMPLE location catalogue.
 * The location catalogue is demo data. Community names are real Dubai areas; every building,
 * developer and coordinate below is a labelled placeholder. Replace via LocationCatalogService.
 */
(function () {
  'use strict';

  E08.PTYPES = {
    residential: [
      ['apartment', 'Apartment'],
      ['villa', 'Villa'],
      ['townhouse', 'Townhouse'],
      ['penthouse', 'Penthouse'],
      ['duplex', 'Duplex'],
      ['hotel_apartment', 'Hotel apartment'],
      ['residential_building', 'Residential building'],
    ],
    commercial: [
      ['office', 'Office'],
      ['shop', 'Shop / Retail'],
      ['showroom', 'Showroom'],
      ['warehouse', 'Warehouse'],
      ['commercial_villa', 'Commercial villa'],
      ['commercial_building', 'Commercial building'],
      ['factory', 'Factory'],
      ['labour_accommodation', 'Labour accommodation'],
    ],
    land: [
      ['residential_plot', 'Residential plot'],
      ['commercial_plot', 'Commercial plot'],
      ['industrial_plot', 'Industrial plot'],
      ['mixed_use_plot', 'Mixed-use plot'],
    ],
  };
  E08.PTYPE_LABEL = {};
  Object.keys(E08.PTYPES).forEach(function (k) {
    E08.PTYPES[k].forEach(function (x) {
      E08.PTYPE_LABEL[x[0]] = x[1];
    });
  });

  E08.AMENITY_GROUPS = [
    {
      id: 'inside',
      l: 'Inside the property',
      scope: 'Private',
      items: [
        ['wardrobes', 'Built-in wardrobes'],
        ['walkin', 'Walk-in closet'],
        ['appliances', 'Kitchen appliances'],
        ['central_ac', 'Central AC'],
        ['smart', 'Smart-home features'],
        ['storage', 'Storage'],
        ['laundry', 'Laundry room'],
      ],
    },
    {
      id: 'outdoor',
      l: 'Private outdoor facilities',
      scope: 'Private',
      items: [
        ['balcony', 'Balcony'],
        ['terrace', 'Terrace'],
        ['garden', 'Garden'],
        ['priv_pool', 'Private pool'],
        ['priv_gym', 'Private gym'],
        ['bbq', 'Barbecue area'],
      ],
    },
    {
      id: 'shared',
      l: 'Shared facilities',
      scope: 'Shared',
      charge: true,
      items: [
        ['sh_pool', 'Swimming pool'],
        ['sh_gym', 'Gym'],
        ['kids_pool', 'Children’s pool'],
        ['play', 'Children’s play area'],
        ['sauna', 'Sauna'],
        ['steam', 'Steam room'],
        ['courts', 'Sports courts'],
        ['communal', 'Communal gardens'],
        ['cowork', 'Coworking space'],
        ['lounge', 'Residents’ lounge'],
      ],
    },
    {
      id: 'services',
      l: 'Building services',
      scope: 'Shared',
      charge: true,
      items: [
        ['sec', 'Security'],
        ['concierge', 'Concierge'],
        ['reception', 'Reception / Lobby'],
        ['lift', 'Lift'],
        ['visitor_parking', 'Visitor parking'],
        ['ev', 'EV charging'],
      ],
    },
    {
      id: 'access',
      l: 'Accessibility',
      scope: 'Accessibility',
      items: [
        ['stepfree', 'Step-free entrance'],
        ['acc_parking', 'Accessible parking'],
        ['acc_lift', 'Accessible lift'],
        ['adapted_bath', 'Adapted bathroom'],
      ],
    },
  ];
  E08.AMENITY = {};
  E08.AMENITY_ORDER = [];
  E08.AMENITY_GROUPS.forEach(function (g) {
    g.items.forEach(function (it) {
      E08.AMENITY[it[0]] = { id: it[0], l: it[1], group: g.id, scope: g.scope, charge: !!g.charge };
      E08.AMENITY_ORDER.push(it[0]);
    });
  });
})();

E08.LocationCatalogService = { subs: () => [] };
E08.ProfileService = { getProfile: () => ({ portfolios: [] }) };
/* schema.js — field definitions, the eight steps, and conditional rules.
 * Field: {key, label, kind, req, when(c,d), opts, help, ph, max, priv, suffix, basisKey, wide}
 * kinds: text textarea select seg multi check money pct int dec year date url email phone area amt
 *  - amt  = money or percentage depending on d[basisKey] ('pct' => percentage)
 *  - area = stored as {raw, unit} exactly as entered (canonical), converted for display only
 * Inactive fields keep their values in state but are not validated or submitted.
 */
(function () {
  'use strict';
  var U = E08.util;

  function O(v, l, h) {
    return { v: String(v), l: l, h: h || '' };
  }
  function F(key, label, kind, x) {
    var f = { key: key, label: label, kind: kind };
    for (var k in x || {}) f[k] = x[k];
    return f;
  }
  var YNU = [O('yes', 'Yes'), O('no', 'No'), O('unknown', 'Unknown')];
  function nums(a, b) {
    return U.range(a, b).map(function (n) {
      return O(n, String(n));
    });
  }

  /** Derived context for conditional logic. */
  E08.ctxOf = function (d) {
    var c = { purp: d.purpose || '', sale: d.purpose === 'sale', rent: d.purpose === 'rent', cat: d.category || '' };
    c.res = c.cat === 'residential';
    c.com = c.cat === 'commercial';
    c.land = c.cat === 'land';
    c.t = d.ptype || '';
    c.typeOk =
      !!c.t &&
      (E08.PTYPES[c.cat] || []).some(function (x) {
        return x[0] === c.t;
      });
    c.off = !!c.cat && !c.land && d.devStatus === 'offplan';
    c.ready = !!c.cat && !c.land && d.devStatus === 'ready';
    c.unitLike =
      ['apartment', 'penthouse', 'duplex', 'hotel_apartment', 'office', 'shop', 'showroom'].indexOf(c.t) >= 0;
    c.villaLike = c.t === 'villa' || c.t === 'townhouse';
    c.building = c.t === 'residential_building' || c.t === 'commercial_building';
    c.bigBuilt =
      c.villaLike ||
      c.building ||
      ['warehouse', 'factory', 'labour_accommodation', 'commercial_villa'].indexOf(c.t) >= 0;
    c.office = c.t === 'office';
    c.shop = c.t === 'shop' || c.t === 'showroom';
    c.wh = c.t === 'warehouse' || c.t === 'factory';
    c.labour = c.t === 'labour_accommodation';
    c.resUnit = c.res && c.typeOk && !c.building;
    c.offInit = c.sale && c.off && d.txn === 'initial';
    c.offResale = c.sale && c.off && d.txn === 'resale';
    c.tenanted = c.ready && d.occupancy === 'tenanted';
    c.rentOff = c.rent && c.off;
    c.classReady = c.typeOk && !!c.purp && (c.land || !!d.devStatus) && (!c.sale || !!d.txn);
    c.priceReady = c.classReady && !c.rentOff;
    return c;
  };
  E08.basisAreaKey = function (c) {
    return c.land ? 'plotArea' : c.unitLike ? 'unitArea' : c.bigBuilt ? 'builtUpArea' : null;
  };
  function parkingCount(d) {
    if (d.parking === 'custom') return U.parseIntSafe(d.parkingCustom) || 0;
    var n = Number(d.parking);
    return isNaN(n) ? 0 : n;
  }

  var FL = [
    /* ---------- 1 Classification ---------- */
    F('purpose', 'Listing purpose', 'seg', {
      req: true,
      opts: [O('sale', 'For sale'), O('rent', 'For rent / lease', 'Long-term (annual) tenancy only.')],
    }),
    F('category', 'Category', 'seg', {
      req: true,
      opts: [
        O('residential', 'Residential'),
        O('commercial', 'Commercial'),
        O('land', 'Land', 'Plots — no bedrooms, furnishing or ready/off-plan status.'),
      ],
    }),
    F('ptype', 'Property type', 'select', {
      req: true,
      when: function (c) {
        return !!c.cat;
      },
      opts: function (c) {
        return (E08.PTYPES[c.cat] || []).map(function (x) {
          return O(x[0], x[1]);
        });
      },
      help: 'Studio is a bedroom option in Property details, not a property type.',
    }),
    F('devStatus', 'Property development status', 'seg', {
      req: true,
      when: function (c) {
        return !!c.cat && !c.land;
      },
      opts: [
        O('ready', 'Ready / Completed', 'Construction is complete. The property may be vacant or occupied.'),
        O('offplan', 'Off-plan / Not yet completed', 'The property is planned or under construction.'),
      ],
    }),
    F('stage', 'Construction stage', 'seg', {
      req: true,
      when: function (c) {
        return c.off;
      },
      opts: [
        O('not_started', 'Not started'),
        O('under_construction', 'Under construction'),
        O('near_completion', 'Near completion'),
      ],
    }),
    F('txn', 'Sale transaction type', 'seg', {
      req: true,
      when: function (c) {
        return c.sale;
      },
      opts: [
        O('initial', 'Initial sale', 'First sale from the developer.'),
        O('resale', 'Resale', 'Sold by a later owner — off-plan units can be resales.'),
      ],
    }),
    F('extRef', 'External / CRM reference', 'text', {
      max: 40,
      priv: true,
      help: 'Your own system’s reference. Kept separate from the platform reference.',
    }),

    /* ---------- 2 Location ---------- */
    F('subcommunity', 'Subcommunity', 'select', {
      when: function (c, d) {
        return !!d.communityId && E08.LocationCatalogService.subs(d.communityId).length > 0;
      },
      opts: function (c, d) {
        return E08.LocationCatalogService.subs(d.communityId).map(function (x) {
          return O(x, x);
        });
      },
      help: 'Where applicable.',
    }),
    F('propName', 'Proposed building / project name', 'text', {
      req: true,
      max: 80,
      when: function (c, d) {
        return !!d.proposing;
      },
    }),
    F('propDeveloper', 'Developer (as you know it)', 'text', {
      max: 80,
      when: function (c, d) {
        return !!d.proposing;
      },
    }),
    F('propNote', 'Notes for the review team', 'textarea', {
      max: 300,
      priv: true,
      when: function (c, d) {
        return !!d.proposing;
      },
    }),
    F('tower', 'Tower / Phase / Cluster', 'text', { max: 60, help: 'Where applicable.' }),
    F('developer', 'Developer', 'text', {
      max: 80,
      req: function (c) {
        return c.off;
      },
      help: function (c) {
        return c.off ? 'Required for off-plan properties.' : 'Filled automatically when you pick a catalogue building.';
      },
    }),
    F('unitNo', 'Unit / Villa / Plot number', 'text', { max: 30, priv: true }),
    F('floorNo', 'Exact floor number', 'text', {
      max: 10,
      priv: true,
      when: function (c) {
        return c.unitLike;
      },
      help: 'Private by default. Choose what floor detail is public in Permit & display.',
    }),
    F('street', 'Street / Additional address', 'text', { max: 120 }),
    F('lat', 'Latitude', 'dec', { ph: 'e.g. 25.0805' }),
    F('lng', 'Longitude', 'dec', { ph: 'e.g. 55.1403' }),
    F('locPrecision', 'Public location precision', 'seg', {
      req: true,
      opts: [
        O('building', 'Building / Project location', 'Shows building or project, subcommunity and community.'),
        O('approximate', 'Approximate location', 'Shows the community only.'),
      ],
    }),

    /* ---------- 3 Property details: size & layout ---------- */
    F('areaUnit', 'Area unit', 'seg', {
      req: true,
      opts: [O('sqft', 'sq ft'), O('sqm', 'sq m')],
      help: 'Switching converts the display only — your entered figures are kept exactly as typed.',
    }),
    F('bedrooms', 'Bedrooms', 'select', {
      req: true,
      when: function (c) {
        return c.resUnit;
      },
      opts: [O('studio', 'Studio')].concat(nums(1, 10), [O('custom', 'More than 10')]),
      help: 'Don’t count maid’s rooms or studies as bedrooms.',
    }),
    F('bedroomsCustom', 'Number of bedrooms', 'int', {
      req: true,
      when: function (c, d) {
        return c.resUnit && d.bedrooms === 'custom';
      },
    }),
    F('bathrooms', 'Bathrooms', 'select', {
      req: true,
      when: function (c) {
        return c.resUnit;
      },
      opts: nums(1, 10).concat([O('custom', 'More than 10')]),
    }),
    F('bathroomsCustom', 'Number of bathrooms', 'int', {
      req: true,
      when: function (c, d) {
        return c.resUnit && d.bathrooms === 'custom';
      },
    }),
    F('unitArea', 'Unit area', 'area', {
      req: true,
      when: function (c) {
        return c.unitLike;
      },
      help: 'Excludes balcony / terrace — enter that separately.',
    }),
    F('builtUpArea', 'Built-up area', 'area', {
      req: true,
      when: function (c) {
        return c.bigBuilt;
      },
    }),
    F('plotArea', 'Plot area', 'area', {
      req: function (c) {
        return c.land;
      },
      when: function (c) {
        return c.villaLike || c.land || c.building || c.wh || c.t === 'commercial_villa';
      },
      help: 'Kept separate from built-up area — never added together.',
    }),
    F('balconyArea', 'Balcony / Terrace area', 'area', {
      when: function (c) {
        return c.resUnit && !c.villaLike;
      },
      help: 'Not added to the unit area.',
    }),
    F('areaSource', 'Area source', 'select', {
      opts: [
        O('title_deed', 'Title deed'),
        O('floor_plan', 'Developer floor plan'),
        O('measurement', 'Measurement'),
        O('other', 'Other'),
      ],
    }),
    F('parking', 'Parking spaces', 'select', {
      when: function (c) {
        return !c.land;
      },
      opts: [O('unknown', 'Unknown'), O('0', 'None (0)')].concat(nums(1, 10), [O('custom', 'More than 10')]),
    }),
    F('parkingCustom', 'Number of parking spaces', 'int', {
      req: true,
      when: function (c, d) {
        return !c.land && d.parking === 'custom';
      },
    }),
    F('parkingType', 'Parking type', 'multi', {
      when: function (c, d) {
        return !c.land && parkingCount(d) > 0;
      },
      opts: [
        O('covered', 'Covered'),
        O('basement', 'Basement'),
        O('garage', 'Garage'),
        O('allocated', 'Allocated'),
        O('shared', 'Shared'),
      ],
    }),
    F('extraRooms', 'Additional rooms', 'multi', {
      when: function (c) {
        return c.res && !c.building;
      },
      opts: [
        O('maid', 'Maid’s room'),
        O('study', 'Study'),
        O('driver', 'Driver’s room'),
        O('storage', 'Storage'),
        O('laundry', 'Laundry'),
      ],
    }),
    F('layoutCode', 'Layout / Unit type code', 'text', {
      max: 30,
      ph: 'e.g. Type 2B',
      when: function (c) {
        return c.unitLike || c.villaLike;
      },
    }),
    F('floorBand', 'Public floor band', 'select', {
      when: function (c) {
        return c.unitLike;
      },
      opts: [
        O('ground', 'Ground'),
        O('low', 'Low floor'),
        O('mid', 'Mid floor'),
        O('high', 'High floor'),
        O('penthouse', 'Penthouse level'),
      ],
      help: 'Shown publicly if you choose “Floor band” in Permit & display.',
    }),
    F('storeys', 'Number of storeys', 'int', {
      when: function (c) {
        return c.villaLike || c.t === 'commercial_villa';
      },
    }),

    /* condition & occupancy */
    F('furnishing', 'Furnishing', 'seg', {
      req: function (c) {
        return c.res;
      },
      when: function (c) {
        return c.ready;
      },
      opts: [O('unfurnished', 'Unfurnished'), O('partly', 'Partly furnished'), O('furnished', 'Furnished')],
    }),
    F('condition', 'Condition', 'select', {
      when: function (c) {
        return c.ready;
      },
      opts: [
        O('brand_new', 'Brand new'),
        O('well_maintained', 'Well maintained'),
        O('renovated', 'Renovated'),
        O('needs_renovation', 'Needs renovation'),
      ],
    }),
    F('occupancy', 'Occupancy', 'seg', {
      req: true,
      when: function (c) {
        return c.ready;
      },
      opts: [O('vacant', 'Vacant'), O('owner', 'Owner occupied'), O('tenanted', 'Tenanted')],
    }),
    F('completionYear', 'Completion year', 'year', {
      when: function (c) {
        return c.ready;
      },
      ph: 'e.g. 2019',
    }),
    F('handoverQ', 'Expected handover quarter', 'select', {
      req: true,
      when: function (c) {
        return c.off;
      },
      opts: [O('1', 'Q1'), O('2', 'Q2'), O('3', 'Q3'), O('4', 'Q4')],
    }),
    F('handoverY', 'Expected handover year', 'select', {
      req: true,
      when: function (c) {
        return c.off;
      },
      opts: function () {
        return nums(U.CUR_YEAR, U.CUR_YEAR + 10);
      },
    }),
    F('handoverDate', 'Exact handover date', 'date', {
      when: function (c) {
        return c.off;
      },
      help: 'Only if the developer has published one.',
    }),
    F('progressPct', 'Construction progress', 'pct', {
      when: function (c) {
        return c.off;
      },
    }),
    F('progressSource', 'Progress source', 'text', {
      max: 120,
      req: true,
      ph: 'e.g. Developer construction update',
      when: function (c, d) {
        return c.off && !U.isBlank(d.progressPct);
      },
    }),
    F('progressDate', 'Progress last updated', 'date', {
      req: true,
      when: function (c, d) {
        return c.off && !U.isBlank(d.progressPct);
      },
    }),
    F('plannedSpec', 'Planned furnishing & specifications', 'textarea', {
      max: 1000,
      when: function (c) {
        return c.off;
      },
    }),
    F('tenure', 'Ownership tenure', 'select', {
      req: true,
      opts: [O('freehold', 'Freehold'), O('leasehold', 'Leasehold'), O('other', 'Other'), O('unknown', 'Unknown')],
    }),
    F('leaseExpiry', 'Lease expiry date', 'date', {
      when: function (c, d) {
        return d.tenure === 'leasehold';
      },
    }),
    F('leaseTerm', 'Remaining lease term', 'text', {
      max: 40,
      ph: 'e.g. 87 years',
      when: function (c, d) {
        return d.tenure === 'leasehold';
      },
    }),
    F('views', 'Views', 'multi', {
      opts: [
        O('sea', 'Sea'),
        O('canal', 'Canal'),
        O('park', 'Park'),
        O('golf', 'Golf'),
        O('skyline', 'Skyline'),
        O('community', 'Community'),
        O('landmark', 'Landmark'),
        O('other', 'Other'),
      ],
    }),
    F('viewExtent', 'View extent', 'seg', {
      when: function (c, d) {
        return (d.views || []).length > 0;
      },
      opts: [O('full', 'Full view'), O('partial', 'Partial view')],
    }),
    F('kitchenLayout', 'Kitchen layout', 'select', {
      when: function (c) {
        return c.res;
      },
      opts: [O('open', 'Open'), O('closed', 'Closed'), O('semi', 'Semi-open')],
    }),
    F('appliances', 'Kitchen appliances included', 'seg', {
      when: function (c) {
        return c.res;
      },
      opts: YNU,
    }),
    F('pets', 'Pets', 'seg', {
      when: function (c) {
        return c.res;
      },
      opts: [
        O('allowed', 'Allowed'),
        O('not_allowed', 'Not allowed'),
        O('approval', 'Subject to approval'),
        O('unknown', 'Unknown'),
      ],
    }),
    F('otherInfo', 'Other property information', 'textarea', { max: 600 }),

    /* type-specific */
    F('attachment', 'Attachment', 'seg', { opts: [O('detached', 'Detached'), O('semi', 'Semi-detached')] }),
    F('position', 'Position', 'seg', {
      opts: [O('corner', 'Corner'), O('end', 'End unit'), O('middle', 'Middle unit')],
    }),
    F('rowType', 'Row', 'seg', { opts: [O('single', 'Single row'), O('back', 'Back-to-back')] }),
    F('landscaped', 'Landscaped garden', 'seg', { opts: YNU }),
    F('officeFit', 'Office fit-out', 'seg', {
      req: true,
      opts: [O('shell', 'Shell-and-core'), O('fitted', 'Fitted'), O('furnished', 'Furnished')],
    }),
    F('partitioned', 'Partitioned', 'seg', { opts: YNU }),
    F('meetingRooms', 'Meeting rooms', 'int', {}),
    F('pantry', 'Pantry', 'seg', { opts: YNU }),
    F('washrooms', 'Washrooms', 'select', {
      opts: [O('private', 'Private'), O('shared', 'Shared'), O('both', 'Private and shared'), O('unknown', 'Unknown')],
    }),
    F('accessHours', 'Access hours', 'text', { max: 60, ph: 'e.g. 24/7' }),
    F('frontage', 'Frontage', 'dec', { suffix: 'm' }),
    F('fitOut', 'Fit-out', 'seg', {
      opts: [O('shell', 'Shell-and-core'), O('fitted', 'Fitted'), O('unknown', 'Unknown')],
    }),
    F('loading', 'Loading access', 'seg', { opts: YNU }),
    F('permittedUse', 'Permitted use', 'text', { max: 120, help: 'As stated on the licence or affection plan.' }),
    F('clearHeight', 'Clear height', 'dec', {}),
    F('clearHeightUnit', 'Clear height unit', 'seg', {
      req: function (c, d) {
        return !U.isBlank(d.clearHeight);
      },
      opts: [O('m', 'metres'), O('ft', 'feet')],
    }),
    F('power', 'Power capacity', 'dec', {}),
    F('powerUnit', 'Power unit', 'select', {
      req: function (c, d) {
        return !U.isBlank(d.power);
      },
      opts: [O('kW', 'kW'), O('kVA', 'kVA'), O('A', 'Amps')],
    }),
    F('loadingBays', 'Loading bays', 'int', {}),
    F('vehicleAccess', 'Vehicle access', 'text', { max: 120, ph: 'e.g. 40 ft trailer access' }),
    F('officeArea', 'Office area', 'area', {}),
    F('tempControl', 'Temperature control', 'select', {
      opts: [O('none', 'None'), O('ac', 'Air-conditioned'), O('cold', 'Cold storage'), O('unknown', 'Unknown')],
    }),
    F('landUse', 'Permitted land use', 'select', {
      opts: [
        O('residential', 'Residential'),
        O('commercial', 'Commercial'),
        O('industrial', 'Industrial'),
        O('mixed', 'Mixed use'),
        O('other', 'Other'),
      ],
    }),
    F('zoning', 'Zoning information', 'text', { max: 160 }),
    F('permittedHeight', 'Permitted height', 'text', { max: 40, ph: 'e.g. G+4' }),
    F('gfa', 'Documented GFA', 'area', { help: 'Only where documented.' }),
    F('far', 'Documented FAR', 'dec', { help: 'Only where documented.' }),
    F('utilitiesLand', 'Utilities', 'multi', {
      opts: [
        O('electricity', 'Electricity'),
        O('water', 'Water'),
        O('sewerage', 'Sewerage'),
        O('telecom', 'Telecom'),
        O('none', 'None', '', true),
        O('unknown', 'Unknown'),
      ],
      exclusive: ['none', 'unknown'],
    }),
    F('roadAccess', 'Road access', 'text', { max: 120 }),
    F('restrictions', 'Development restrictions', 'textarea', { max: 600 }),
    F('floors', 'Floors', 'int', {}),
    F('unitCount', 'Unit count', 'int', {}),
    F('unitMix', 'Unit mix', 'text', { max: 160, ph: 'e.g. 20 × 1BR, 12 × 2BR' }),
    F('bldOccupancy', 'Building occupancy', 'text', { max: 120, ph: 'e.g. 85% leased' }),
    F('lifts', 'Lifts', 'int', {}),
    F('bldParking', 'Parking spaces', 'int', {}),
    F('rooms', 'Rooms', 'int', {}),
    F('capacity', 'Approved capacity', 'int', { help: 'Only where documented by the approving authority.' }),
    F('lbBaths', 'Bathrooms', 'int', {}),
    F('kitchens', 'Kitchens', 'int', {}),
    F('commonFacilities', 'Common facilities', 'text', { max: 160 }),

    /* ---------- 4 Price & terms ---------- */
    F('askingPrice', 'Asking price', 'money', { req: true }),
    F('negotiable', 'Negotiable', 'seg', { opts: [O('yes', 'Negotiable'), O('no', 'Fixed price')] }),
    F('possession', 'Possession', 'select', {
      req: true,
      opts: [
        O('now', 'Available now'),
        O('on_transfer', 'Vacant on transfer'),
        O('subject_tenancy', 'Subject to tenancy'),
        O('expected', 'Expected date'),
      ],
    }),
    F('possessionDate', 'Expected possession date', 'date', {
      req: true,
      when: function (c, d) {
        return d.possession === 'expected';
      },
    }),
    F('rentalIncome', 'Actual annual rental income', 'money', { suffix: '/ year' }),
    F('tenancyExpiry', 'Tenancy expiry date', 'date', {}),
    F('tenancyPublic', 'Tenancy details', 'seg', {
      req: true,
      opts: [O('show', 'Show publicly'), O('hide', 'Keep private')],
    }),
    F('serviceCharge', 'Service charge', 'money', {}),
    F('serviceBasis', 'Service charge basis', 'select', {
      req: function (c, d) {
        return !U.isBlank(d.serviceCharge);
      },
      opts: [O('per_year', 'AED / year (total)'), O('per_sqft', 'AED / sq ft / year')],
    }),
    F('servicePeriod', 'Applicable period', 'text', { max: 40, ph: 'e.g. 2026 budget' }),
    F('unitPrice', 'Unit price', 'money', { req: true }),
    F('bookingBasis', 'Booking amount basis', 'seg', {
      req: true,
      opts: [O('aed', 'AED amount'), O('pct', 'Percentage of price')],
    }),
    F('booking', 'Booking amount', 'amt', { req: true, basisKey: 'bookingBasis' }),
    F('bookingInSchedule', 'The payment schedule below already includes the booking payment', 'check', {
      help: 'Tick this only if a schedule row represents the booking — so it is never counted twice.',
    }),
    F('postHandover', 'Post-handover payment plan', 'seg', { opts: [O('yes', 'Yes'), O('no', 'No')] }),
    F('incentives', 'Incentives & conditions', 'textarea', {
      max: 600,
      help: 'State conditions exactly. No guaranteed returns.',
    }),
    F('incentiveExpiry', 'Incentive expiry', 'date', {}),
    F('otherCostsOff', 'Other disclosed costs', 'text', { max: 200 }),
    F('priceBasis', 'What the asking price covers', 'select', {
      req: true,
      opts: [
        O('incl', 'Includes the outstanding developer balance'),
        O('seller', 'Paid to the seller — outstanding balance is paid on top'),
      ],
    }),
    F('priceIncludes', 'Explain what the asking price includes', 'textarea', { req: true, max: 500 }),
    F('originalPrice', 'Original purchase price', 'money', {
      priv: true,
      help: 'Used to check figures. Not shown publicly.',
    }),
    F('paidToDev', 'Amount paid to developer', 'money', {}),
    F('outstanding', 'Outstanding developer balance', 'money', { zeroOk: true }),
    F('payToSeller', 'Amount payable to seller', 'money', {}),
    F('remainingSchedule', 'Remaining payment schedule', 'textarea', { max: 600 }),
    F('nextInstDate', 'Next instalment date', 'date', {}),
    F('nextInstAmt', 'Next instalment amount', 'money', {}),
    F('transferElig', 'Transfer eligibility', 'select', {
      req: true,
      opts: [O('confirmed', 'Confirmed'), O('pending', 'Pending'), O('unknown', 'Unknown')],
    }),
    F('nocStatus', 'NOC / Assignment status', 'select', {
      opts: [O('not_applied', 'Not applied'), O('applied', 'Applied'), O('issued', 'Issued'), O('unknown', 'Unknown')],
    }),
    F('transferCharges', 'Transfer charges', 'money', {}),
    F('transferPayer', 'Transfer charges paid by', 'select', {
      opts: [O('buyer', 'Buyer'), O('seller', 'Seller'), O('shared', 'Shared'), O('unknown', 'Not agreed')],
    }),
    F('finSource', 'Financial information source', 'text', { max: 120, ph: 'e.g. Developer statement of account' }),
    F('finDate', 'Financial information date', 'date', {}),
    F('annualRent', 'Annual rent', 'money', { req: true, suffix: '/ year' }),
    F('availability', 'Availability', 'seg', {
      req: true,
      opts: [O('now', 'Available now'), O('from', 'Available from a date')],
    }),
    F('availableFrom', 'Available from', 'date', {
      req: true,
      when: function (c, d) {
        return d.availability === 'from';
      },
    }),
    F('minTenancy', 'Minimum tenancy', 'select', {
      opts: [O('12', '12 months'), O('24', '24 months'), O('36', '36 months'), O('other', 'Other — see terms')],
    }),
    F('cheques', 'Accepted cheque counts', 'multi', {
      opts: [O('1', '1 cheque'), O('2', '2'), O('3', '3'), O('4', '4'), O('6', '6'), O('12', '12')],
    }),
    F('depositBasis', 'Security deposit basis', 'seg', { opts: [O('aed', 'Fixed AED'), O('pct', '% of annual rent')] }),
    F('deposit', 'Security deposit', 'amt', {
      basisKey: 'depositBasis',
      req: function (c, d) {
        return !U.isBlank(d.depositBasis);
      },
    }),
    F('refundTerms', 'Deposit refund terms', 'text', { max: 200 }),
    F('upfrontFees', 'Other upfront fees', 'money', {}),
    F('upfrontNote', 'What the upfront fees cover', 'text', {
      max: 160,
      req: function (c, d) {
        return !U.isBlank(d.upfrontFees);
      },
    }),
    F('utilities', 'Included utilities', 'multi', {
      when: function (c) {
        return !c.land;
      },
      opts: [
        O('electricity', 'Electricity'),
        O('water', 'Water'),
        O('internet', 'Internet'),
        O('cooling', 'Cooling'),
        O('none', 'None'),
        O('unknown', 'Unknown'),
      ],
      exclusive: ['none', 'unknown'],
    }),
    F('cooling', 'Cooling arrangement', 'select', {
      when: function (c) {
        return !c.land;
      },
      opts: [
        O('district', 'District cooling'),
        O('central', 'Central AC (building)'),
        O('split', 'Split units'),
        O('unknown', 'Unknown'),
      ],
    }),
    F('maintenance', 'Maintenance', 'select', {
      opts: [
        O('landlord', 'Landlord'),
        O('tenant_minor', 'Tenant (minor), landlord (major)'),
        O('tenant', 'Tenant'),
        O('unknown', 'Not agreed'),
      ],
    }),
    F(
      'commBasis',
      function (c) {
        return c.rent ? 'Brokerage fee basis' : 'Brokerage commission basis';
      },
      'seg',
      { opts: [O('aed', 'Fixed AED'), O('pct', 'Percentage')] },
    ),
    F(
      'commission',
      function (c) {
        return c.rent ? 'Brokerage fee' : 'Brokerage commission';
      },
      'amt',
      {
        basisKey: 'commBasis',
        req: function (c, d) {
          return !U.isBlank(d.commBasis);
        },
      },
    ),
    F('commPayer', 'Paid by', 'select', {
      opts: function (c) {
        return c.rent
          ? [O('tenant', 'Tenant'), O('landlord', 'Landlord'), O('shared', 'Shared'), O('none', 'No brokerage')]
          : [O('buyer', 'Buyer'), O('seller', 'Seller'), O('shared', 'Shared'), O('none', 'No commission')];
      },
    }),
    F('taxTreatment', 'Tax treatment', 'select', {
      opts: [
        O('incl', 'Amounts include VAT where applicable'),
        O('excl', 'VAT is added where applicable'),
        O('na', 'Not applicable'),
        O('unknown', 'Not confirmed'),
      ],
      help: 'No tax rate is assumed — state the treatment that applies.',
    }),
    F('otherCharges', 'Other disclosed charges', 'text', { max: 200 }),
    F('viewing', 'Viewing arrangements', 'select', {
      opts: [
        O('appointment', 'By appointment'),
        O('flexible', 'Flexible'),
        O('weekdays', 'Weekdays only'),
        O('weekends', 'Weekends only'),
        O('virtual', 'Virtual viewing available'),
        O('restricted', 'Restricted — tenant occupied'),
      ],
    }),
    F('viewingNotes', 'Viewing notes', 'text', { max: 160 }),

    /* ---------- 5 Marketing ---------- */
    F('title', 'Listing title', 'text', { req: true, max: 100 }),
    F('description', 'Property description', 'textarea', { req: true, max: 5000, rows: 9 }),
    F('locHighlights', 'Location highlights', 'textarea', {
      max: 1000,
      help: 'Factual distances and nearby places only.',
    }),
    F('altLang', 'Language', 'select', {
      opts: [O('ar', 'Arabic'), O('ru', 'Russian'), O('zh', 'Chinese'), O('fr', 'French'), O('other', 'Other')],
    }),
    F('altTitle', 'Title (additional language)', 'text', {
      max: 100,
      when: function (c, d) {
        return !!d.altLang;
      },
    }),
    F('altDesc', 'Description (additional language)', 'textarea', {
      max: 5000,
      when: function (c, d) {
        return !!d.altLang;
      },
    }),
    F('notes', 'Internal broker notes', 'textarea', { max: 2000, priv: true }),

    /* ---------- 6 Media ---------- */
    F('tourUrl', 'Virtual tour link', 'url', {
      ph: 'https://my.matterport.com/show/?m=…',
      help: 'Matterport and Kuula links are recognised.',
    }),
    F('mediaRights', 'I confirm I have permission to use the uploaded photos, videos and documents.', 'check', {
      req: true,
      reqMsg: 'Confirm you have permission to use this media.',
    }),

    /* ---------- 7 Permit & display ---------- */
    F('permitNo', 'Advertising permit number', 'text', {
      req: true,
      max: 40,
      help: 'Entered exactly as issued. Format is checked during verification, not here.',
    }),
    F('permitUrl', 'Official permit verification link', 'url', {
      help: 'Shown as “link provided by broker — not reviewed” until verified.',
    }),
    F('permitExpiry', 'Permit expiry', 'date', {}),
    F('authType', 'Marketing authorization', 'select', {
      req: true,
      opts: [
        O('owner_agreement', 'Owner–broker agreement'),
        O('owner_letter', 'Owner authorization letter'),
        O('developer', 'Developer authorization'),
        O('other', 'Other'),
      ],
    }),
    F('authExpiry', 'Authorization expiry', 'date', {}),
    F('overrideContact', 'Use different contact details for this listing', 'check', {}),
    F('cPhone', 'Phone for this listing', 'phone', {
      req: true,
      when: function (c, d) {
        return !!d.overrideContact;
      },
    }),
    F('cWhats', 'WhatsApp for this listing', 'phone', {
      when: function (c, d) {
        return !!d.overrideContact;
      },
    }),
    F('cEmail', 'Enquiry email for this listing', 'email', {
      when: function (c, d) {
        return !!d.overrideContact;
      },
    }),
    F('cChannels', 'Preferred contact channels', 'multi', {
      when: function (c, d) {
        return !!d.overrideContact;
      },
      opts: [O('phone', 'Phone'), O('whatsapp', 'WhatsApp'), O('email', 'Email')],
    }),
    F('cHours', 'Contact hours', 'text', {
      max: 60,
      when: function (c, d) {
        return !!d.overrideContact;
      },
      ph: 'e.g. 9am–7pm, Mon–Sat',
    }),
    F('floorDisplay', 'Public floor display', 'seg', {
      req: true,
      when: function (c) {
        return c.unitLike;
      },
      opts: [O('exact', 'Exact floor'), O('band', 'Floor band'), O('hidden', 'Hidden')],
    }),
    F('portfolio', 'Portfolio', 'select', {
      opts: function () {
        return E08.ProfileService.getProfile().portfolios.map(function (p) {
          return O(p[0], p[1]);
        });
      },
    }),
    F('promotion', 'Promotion', 'select', {
      opts: [O('none', 'No promotion'), O('featured', 'Featured placement — subject to membership')],
      help: 'Promotion never adds a verification badge.',
    }),
    F('scheduleDate', 'Preferred submission date', 'date', {
      help: 'Saved as a preference. Scheduling needs the publishing service.',
    }),

    /* ---------- 8 Review ---------- */
    F('decl1', 'The information in this listing is accurate to the best of my knowledge.', 'check', { req: true }),
    F('decl2', 'I am authorised to advertise this property.', 'check', { req: true }),
    F('decl3', 'I have the rights to use the photos, videos and documents in this listing.', 'check', { req: true }),
  ];
  E08.FIELDS = {};
  FL.forEach(function (f) {
    E08.FIELDS[f.key] = f;
  });

  function w(fn) {
    return fn;
  }
  /* Sections: {id, title, kind?, when?(c,d), fields[], optional?, note?} — kind = widget rendered before fields */
  E08.STEPS = [
    {
      id: 'class',
      title: 'Classification',
      desc: 'What you’re listing. These answers decide which questions appear next.',
      sections: [
        {
          id: 'cls-purpose',
          title: 'Listing purpose',
          fields: ['purpose'],
          note: 'Short-term and holiday-home rentals aren’t available in this version. They need a separate workflow — holiday-home permit, nightly rates and an availability calendar — planned for later.',
        },
        { id: 'cls-prop', title: 'Property', fields: ['category', 'ptype', 'devStatus', 'stage'] },
        {
          id: 'cls-sale',
          title: 'Sale transaction',
          when: function (c) {
            return c.sale;
          },
          fields: ['txn'],
        },
        { id: 'cls-ref', title: 'References', kind: 'ref', fields: ['extRef'] },
      ],
    },
    {
      id: 'loc',
      title: 'Location',
      desc: 'Where the property is. Exact identifiers stay private.',
      sections: [
        { id: 'loc-area', title: 'Area', kind: 'community', fields: ['subcommunity'] },
        {
          id: 'loc-bld',
          title: 'Building / Project',
          kind: 'building',
          fields: ['propName', 'propDeveloper', 'propNote', 'tower'],
        },
        {
          id: 'loc-unit',
          title: 'Unit & address',
          fields: ['developer', 'unitNo', 'floorNo', 'street'],
          note: 'Your unit number and private verification details will not appear publicly.',
        },
        { id: 'loc-map', title: 'Map location', kind: 'map', fields: ['lat', 'lng'] },
        { id: 'loc-pub', title: 'Public location', fields: ['locPrecision'] },
      ],
    },
    {
      id: 'details',
      title: 'Property details',
      desc: 'Size, condition and features. Only questions that fit this property are shown.',
      sections: [
        {
          id: 'det-need',
          title: 'Classification needed',
          kind: 'needClass',
          when: function (c) {
            return !c.typeOk;
          },
        },
        {
          id: 'det-size',
          title: 'Size & layout',
          kind: 'areaBasis',
          when: function (c) {
            return c.typeOk;
          },
          fields: [
            'areaUnit',
            'bedrooms',
            'bedroomsCustom',
            'bathrooms',
            'bathroomsCustom',
            'unitArea',
            'builtUpArea',
            'plotArea',
            'balconyArea',
            'areaSource',
            'parking',
            'parkingCustom',
            'parkingType',
            'extraRooms',
            'layoutCode',
            'floorBand',
            'storeys',
          ],
        },
        {
          id: 'det-cond',
          title: 'Condition & occupancy',
          when: function (c) {
            return c.typeOk && (c.ready || c.off);
          },
          fields: [
            'furnishing',
            'condition',
            'occupancy',
            'completionYear',
            'handoverQ',
            'handoverY',
            'handoverDate',
            'progressPct',
            'progressSource',
            'progressDate',
            'plannedSpec',
          ],
        },
        {
          id: 'det-tenure',
          title: 'Ownership',
          when: function (c) {
            return c.typeOk && c.sale;
          },
          fields: ['tenure', 'leaseExpiry', 'leaseTerm'],
        },
        {
          id: 'det-villa',
          title: 'Villa / townhouse details',
          when: function (c) {
            return c.villaLike;
          },
          fields: ['attachment', 'position', 'rowType', 'landscaped'],
          note: 'Private pool and garden: select them under Features & amenities so they’re listed once.',
        },
        {
          id: 'det-office',
          title: 'Office details',
          when: function (c) {
            return c.office;
          },
          fields: ['officeFit', 'partitioned', 'meetingRooms', 'pantry', 'washrooms', 'accessHours'],
        },
        {
          id: 'det-shop',
          title: 'Shop / showroom details',
          when: function (c) {
            return c.shop;
          },
          fields: ['frontage', 'fitOut', 'loading', 'permittedUse'],
        },
        {
          id: 'det-wh',
          title: 'Warehouse / factory details',
          when: function (c) {
            return c.wh;
          },
          fields: [
            'clearHeight',
            'clearHeightUnit',
            'power',
            'powerUnit',
            'loadingBays',
            'vehicleAccess',
            'officeArea',
            'tempControl',
            'permittedUse',
          ],
        },
        {
          id: 'det-land',
          title: 'Land details',
          when: function (c) {
            return c.land && c.typeOk;
          },
          fields: ['landUse', 'zoning', 'permittedHeight', 'gfa', 'far', 'utilitiesLand', 'roadAccess', 'restrictions'],
        },
        {
          id: 'det-bld',
          title: 'Whole building',
          when: function (c) {
            return c.building;
          },
          fields: ['floors', 'unitCount', 'unitMix', 'bldOccupancy', 'lifts', 'bldParking'],
        },
        {
          id: 'det-labour',
          title: 'Labour accommodation',
          when: function (c) {
            return c.labour;
          },
          fields: ['rooms', 'capacity', 'lbBaths', 'kitchens', 'commonFacilities'],
        },
        {
          id: 'det-views',
          title: 'Views & kitchen',
          optional: true,
          when: function (c) {
            return c.typeOk && !c.land;
          },
          fields: ['views', 'viewExtent', 'kitchenLayout', 'appliances'],
        },
        {
          id: 'det-amen',
          title: 'Features & amenities',
          kind: 'amen',
          when: function (c) {
            return c.typeOk && !c.land;
          },
          fields: ['pets'],
        },
        {
          id: 'det-custom',
          title: 'Additional features & amenities',
          optional: true,
          kind: 'custom',
          when: function (c) {
            return c.typeOk;
          },
        },
        {
          id: 'det-other',
          title: 'Other property information',
          optional: true,
          when: function (c) {
            return c.typeOk;
          },
          fields: ['otherInfo'],
        },
      ],
    },
    {
      id: 'price',
      title: 'Price & terms',
      desc: 'All amounts in AED. Show what a buyer or tenant actually pays, and when.',
      sections: [
        {
          id: 'pr-need',
          title: 'Classification needed',
          kind: 'needClass',
          when: function (c) {
            return !c.priceReady;
          },
        },
        {
          id: 'pr-sale',
          title: 'Price & possession',
          when: function (c) {
            return c.priceReady && c.sale && !c.off;
          },
          fields: ['askingPrice', 'negotiable', 'possession', 'possessionDate'],
        },
        {
          id: 'pr-ten',
          title: 'Tenancy',
          when: function (c) {
            return c.priceReady && c.sale && c.tenanted;
          },
          fields: ['rentalIncome', 'tenancyExpiry', 'tenancyPublic'],
        },
        {
          id: 'pr-svc',
          title: 'Service charges',
          when: function (c) {
            return c.priceReady && c.sale && !c.land;
          },
          fields: ['serviceCharge', 'serviceBasis', 'servicePeriod'],
        },
        {
          id: 'pr-salesum',
          title: 'Price summary',
          kind: 'saleSummary',
          when: function (c) {
            return c.priceReady && c.sale && !c.off;
          },
        },
        {
          id: 'pr-offi',
          title: 'Off-plan price & booking',
          when: function (c) {
            return c.priceReady && c.offInit;
          },
          fields: ['unitPrice', 'bookingBasis', 'booking', 'bookingInSchedule', 'postHandover'],
        },
        {
          id: 'pr-ms',
          title: 'Payment schedule',
          kind: 'milestones',
          when: function (c) {
            return c.priceReady && c.offInit;
          },
        },
        {
          id: 'pr-inc',
          title: 'Incentives & other costs',
          optional: true,
          when: function (c) {
            return c.priceReady && c.offInit;
          },
          fields: ['incentives', 'incentiveExpiry', 'otherCostsOff'],
        },
        {
          id: 'pr-res',
          title: 'Resale price',
          when: function (c) {
            return c.priceReady && c.offResale;
          },
          fields: ['askingPrice', 'priceBasis', 'priceIncludes'],
        },
        {
          id: 'pr-resfin',
          title: 'Developer payments',
          when: function (c) {
            return c.priceReady && c.offResale;
          },
          fields: [
            'originalPrice',
            'paidToDev',
            'outstanding',
            'payToSeller',
            'remainingSchedule',
            'nextInstDate',
            'nextInstAmt',
          ],
        },
        {
          id: 'pr-restr',
          title: 'Transfer',
          when: function (c) {
            return c.priceReady && c.offResale;
          },
          fields: ['transferElig', 'nocStatus', 'transferCharges', 'transferPayer', 'finSource', 'finDate'],
        },
        {
          id: 'pr-soa',
          title: 'Statement of account',
          optional: true,
          kind: 'doc',
          doc: 'soa',
          when: function (c) {
            return c.priceReady && c.offResale;
          },
        },
        {
          id: 'pr-ressum',
          title: 'What the buyer pays',
          kind: 'resaleSummary',
          when: function (c) {
            return c.priceReady && c.offResale;
          },
        },
        {
          id: 'pr-rent',
          title: 'Rent',
          when: function (c) {
            return c.priceReady && c.rent;
          },
          fields: ['annualRent', 'availability', 'availableFrom', 'minTenancy', 'cheques'],
        },
        {
          id: 'pr-cq',
          title: 'Rent by cheque arrangement',
          optional: true,
          kind: 'cheques',
          when: function (c, d) {
            return c.priceReady && c.rent && (d.cheques || []).length > 0;
          },
        },
        {
          id: 'pr-dep',
          title: 'Deposit & running costs',
          when: function (c) {
            return c.priceReady && c.rent;
          },
          fields: [
            'depositBasis',
            'deposit',
            'refundTerms',
            'upfrontFees',
            'upfrontNote',
            'utilities',
            'cooling',
            'maintenance',
          ],
        },
        {
          id: 'pr-fees',
          title: 'Fees, tax & viewing',
          when: function (c) {
            return c.priceReady;
          },
          fields: ['commBasis', 'commission', 'commPayer', 'taxTreatment', 'otherCharges', 'viewing', 'viewingNotes'],
        },
        {
          id: 'pr-rentsum',
          title: 'Cost summary',
          kind: 'rentSummary',
          when: function (c) {
            return c.priceReady && c.rent;
          },
        },
        {
          id: 'pr-extra',
          title: 'Additional terms',
          optional: true,
          kind: 'extra',
          when: function (c) {
            return c.priceReady;
          },
        },
      ],
    },
    {
      id: 'marketing',
      title: 'Marketing',
      desc: 'Describe the property factually. Buyers contact you through the listing — not through details in the text.',
      sections: [
        { id: 'mk-copy', title: 'Title & description', kind: 'generate', fields: ['title', 'description'] },
        { id: 'mk-hl', title: 'Key highlights', optional: true, kind: 'highlights' },
        { id: 'mk-loc', title: 'Location highlights', optional: true, fields: ['locHighlights'] },
        {
          id: 'mk-lang',
          title: 'Additional language version',
          optional: true,
          fields: ['altLang', 'altTitle', 'altDesc'],
        },
        {
          id: 'mk-notes',
          title: 'Internal broker notes',
          fields: ['notes'],
          note: 'Private. Never shown on the listing or in previews.',
        },
      ],
    },
    {
      id: 'media',
      title: 'Photos & media',
      desc: 'Photos, videos, floor plans and documents. Files stay on this device until a storage service is connected.',
      sections: [
        { id: 'md-ph', title: 'Photos', kind: 'photos' },
        { id: 'md-vd', title: 'Videos', kind: 'videos' },
        { id: 'md-fp', title: 'Floor plans', optional: true, kind: 'plans' },
        { id: 'md-tour', title: 'Virtual tour', optional: true, kind: 'tour', fields: ['tourUrl'] },
        { id: 'md-br', title: 'Brochure', optional: true, kind: 'brochure' },
        { id: 'md-rights', title: 'Media rights', fields: ['mediaRights'] },
      ],
    },
    {
      id: 'permit',
      title: 'Permit & display',
      desc: 'Regulatory details, how buyers reach you, and what is shown publicly.',
      sections: [
        {
          id: 'pm-ver',
          title: 'Advertising permit',
          kind: 'verify',
          fields: ['permitNo', 'permitUrl', 'permitExpiry'],
        },
        { id: 'pm-qr', title: 'Official permit QR', optional: true, kind: 'doc', doc: 'qr' },
        { id: 'pm-broker', title: 'Broker licence & brokerage', kind: 'broker' },
        { id: 'pm-auth', title: 'Marketing authorization', fields: ['authType', 'authExpiry'] },
        { id: 'pm-authdoc', title: 'Authorization document', optional: true, kind: 'doc', doc: 'auth' },
        {
          id: 'pm-contact',
          title: 'Contact',
          kind: 'contact',
          fields: ['overrideContact', 'cPhone', 'cWhats', 'cEmail', 'cChannels', 'cHours'],
        },
        {
          id: 'pm-disp',
          title: 'Display',
          kind: 'precisionNote',
          fields: ['floorDisplay', 'portfolio', 'promotion', 'scheduleDate'],
        },
      ],
    },
    {
      id: 'review',
      title: 'Review & publish',
      desc: 'Check everything, preview the public listing, then submit for review.',
      sections: [
        { id: 'rv-sum', title: 'Summary', kind: 'review' },
        { id: 'rv-decl', title: 'Declarations', fields: ['decl1', 'decl2', 'decl3'] },
      ],
    },
  ];

  /* Widget error keys -> step index (for focus + step status) */
  E08.WIDGET_KEYS = {
    community: 1,
    building: 1,
    amen: 2,
    custom: 2,
    milestones: 3,
    cheques: 3,
    extra: 3,
    'doc-soa': 3,
    highlights: 4,
    photos: 5,
    videos: 5,
    plans: 5,
    'doc-qr': 6,
    'doc-auth': 6,
  };
  E08.WIDGET_ERRKEY = {
    community: 'community',
    amen: 'amen',
    custom: 'custom',
    milestones: 'milestones',
    cheques: 'cheques',
    extra: 'extra',
    highlights: 'highlights',
    photos: 'photos',
    videos: 'videos',
    plans: 'plans',
  };
  E08.WIDGET_LABEL = {
    community: 'Area / Community',
    building: 'Building / Project',
    amen: 'Features & amenities',
    custom: 'Additional features',
    milestones: 'Payment schedule',
    cheques: 'Rent by cheque arrangement',
    extra: 'Additional terms',
    highlights: 'Key highlights',
    photos: 'Photos',
    videos: 'Videos',
    plans: 'Floor plans',
    'doc-soa': 'Statement of account',
    'doc-qr': 'Permit QR',
    'doc-auth': 'Authorization document',
  };
  E08.STEP_OF = {};
  E08.STEPS.forEach(function (st, i) {
    st.sections.forEach(function (s) {
      (s.fields || []).forEach(function (k) {
        E08.STEP_OF[k] = i;
      });
    });
  });
  Object.keys(E08.WIDGET_KEYS).forEach(function (k) {
    E08.STEP_OF[k] = E08.WIDGET_KEYS[k];
  });

  E08.isReq = function (f, c, d) {
    return typeof f.req === 'function' ? !!f.req(c, d) : !!f.req;
  };
  E08.labelOf = function (f, c, d) {
    return typeof f.label === 'function' ? f.label(c || E08.ctxOf(d || {}), d) : f.label;
  };
  E08.optsOf = function (f, c, d) {
    return typeof f.opts === 'function' ? f.opts(c, d) : f.opts || [];
  };
  E08.effKind = function (f, d) {
    return f.kind === 'amt' ? (d[f.basisKey] === 'pct' ? 'pct' : 'money') : f.kind;
  };
  E08.activeSections = function (i, c, d) {
    return E08.STEPS[i].sections.filter(function (s) {
      return !s.when || s.when(c, d);
    });
  };
  E08.activeFieldKeys = function (c, d, stepIdx) {
    var keys = [],
      seen = {};
    E08.STEPS.forEach(function (st, i) {
      if (stepIdx != null && i !== stepIdx) return;
      E08.activeSections(i, c, d).forEach(function (s) {
        (s.fields || []).forEach(function (k) {
          var f = E08.FIELDS[k];
          if (seen[k] || (f.when && !f.when(c, d))) return;
          seen[k] = 1;
          keys.push(k);
        });
      });
    });
    return keys;
  };
  /** Signature of what is visible — used to decide when a full re-render is needed while typing. */
  E08.visibilitySignature = function (d, stepIdx) {
    var c = E08.ctxOf(d);
    return (
      E08.activeSections(stepIdx, c, d)
        .map(function (s) {
          return s.id;
        })
        .join(',') +
      '|' +
      E08.activeFieldKeys(c, d, stepIdx).join(',')
    );
  };
  E08.defaultData = function () {
    return {
      areaUnit: 'sqft',
      locPrecision: 'building',
      floorDisplay: 'band',
      proposing: false,
      coordsAuto: false,
      developerAuto: false,
      views: [],
      extraRooms: [],
      parkingType: [],
      utilities: [],
      utilitiesLand: [],
      cheques: [],
      cChannels: [],
      bookingInSchedule: false,
      overrideContact: false,
      mediaRights: false,
      decl1: false,
      decl2: false,
      decl3: false,
    };
  };
  E08.parkingCount = parkingCount;
  void w;
})();

/* pricing.js — price calculations. All money is integer fils; percentages integer basis points.
 * Calculations explain mismatches; they never alter the figures the broker entered.
 */
(function () {
  'use strict';
  var U = E08.util;

  function money(v) {
    var m = U.parseMoney(v);
    return m == null || isNaN(m) ? null : m;
  }
  function amt(d, key, basisKey, baseFils) {
    if (U.isBlank(d[key])) return { fils: null, bp: null, ok: true, blank: true };
    if (d[basisKey] === 'pct') {
      var bp = U.parsePct(d[key]);
      if (bp == null || isNaN(bp)) return { ok: false };
      return { bp: bp, fils: baseFils != null ? U.pctOf(baseFils, bp) : null, ok: true };
    }
    var f = money(d[key]);
    return f == null ? { ok: false } : { fils: f, bp: null, ok: true };
  }
  E08.pricing = { money: money, amt: amt };

  /** Price-per-area basis */
  E08.pricing.sale = function (st) {
    var d = st.d,
      c = E08.ctxOf(d),
      unit = d.areaUnit || 'sqft';
    var priceKey = c.offInit ? 'unitPrice' : 'askingPrice';
    var price = money(d[priceKey]);
    var bk = E08.basisAreaKey(c),
      area = bk ? U.areaIn(d[bk], unit) : null;
    var out = { price: price, basisKey: bk, basisLabel: bk ? E08.FIELDS[bk].label : null, ppa: null, unit: unit };
    if (price && area && !isNaN(area) && area > 0) out.ppa = Math.round(price / area);
    var sc = money(d.serviceCharge);
    if (sc != null) {
      if (d.serviceBasis === 'per_sqft') {
        var sqft = bk ? U.areaIn(d[bk], 'sqft') : null;
        out.serviceAnnual = sqft && !isNaN(sqft) ? Math.round(sc * sqft) : null;
        out.serviceNote =
          out.serviceAnnual != null
            ? U.fmtAED(sc) + ' / sq ft / year × ' + U.fmtNum(sqft, 2) + ' sq ft (' + out.basisLabel.toLowerCase() + ')'
            : 'Add the ' + (out.basisLabel || 'area').toLowerCase() + ' to estimate the annual total.';
      } else if (d.serviceBasis === 'per_year') out.serviceAnnual = sc;
    }
    var cm = amt(d, 'commission', 'commBasis', price);
    out.commission = cm.ok ? cm : null;
    return out;
  };

  /** Off-plan initial sale schedule check */
  E08.pricing.schedule = function (st) {
    var d = st.d,
      price = money(d.unitPrice),
      okPrice = price != null && price > 0;
    var out = { price: price, okPrice: okPrice, rows: [], invalid: [], status: 'empty', msg: '', ok: false };
    var booking = amt(d, 'booking', 'bookingBasis', okPrice ? price : null);
    out.booking = booking;
    var includeBooking = !d.bookingInSchedule && booking.ok && !booking.blank;
    var allPct = true,
      sumBp = 0,
      sumF = 0,
      pctItems = 0,
      convertible = true;
    if (includeBooking) {
      if (booking.bp != null) {
        sumBp += booking.bp;
        pctItems++;
      } else allPct = false;
      if (booking.fils != null) sumF += booking.fils;
      else convertible = false;
    }
    (st.milestones || []).forEach(function (r, i) {
      if (r.mode === 'pct') {
        var bp = U.parsePct(r.value);
        if (bp == null || isNaN(bp)) {
          out.invalid.push(i);
          out.rows.push(null);
          return;
        }
        sumBp += bp;
        pctItems++;
        var f = okPrice ? U.pctOf(price, bp) : null;
        if (f == null) convertible = false;
        else sumF += f;
        out.rows.push({ bp: bp, fils: f });
      } else {
        var m = money(r.value);
        if (m == null) {
          out.invalid.push(i);
          out.rows.push(null);
          return;
        }
        allPct = false;
        sumF += m;
        out.rows.push({ fils: m, bp: okPrice ? Math.round((m * 10000) / price) : null });
      }
    });
    out.sumBp = sumBp;
    out.sumF = sumF;
    out.includeBooking = includeBooking;
    if (!(st.milestones || []).length) {
      out.status = 'empty';
      out.msg = 'Add the payment milestones that make up the price.';
      return out;
    }
    if (out.invalid.length) {
      out.status = 'invalid';
      out.msg = 'Some rows have an amount or percentage that isn’t valid yet.';
      return out;
    }
    if (allPct) {
      if (sumBp === 10000) {
        out.status = 'match';
        out.ok = true;
        out.msg = 'Schedule totals 100% of the unit price' + (okPrice ? ' (' + U.fmtAED(price) + ').' : '.');
      } else if (sumBp < 10000) {
        out.status = 'under';
        out.msg =
          'Schedule totals ' +
          U.fmtBp(sumBp) +
          ' — ' +
          U.fmtBp(10000 - sumBp) +
          ' of the unit price isn’t scheduled. Adjust the rows; nothing is changed automatically.';
      } else {
        out.status = 'over';
        out.msg =
          'Schedule totals ' +
          U.fmtBp(sumBp) +
          ', which is ' +
          U.fmtBp(sumBp - 10000) +
          ' more than the unit price. Check whether the booking is counted twice.';
      }
      return out;
    }
    if (!okPrice || !convertible) {
      out.status = 'needPrice';
      out.msg = 'Enter the unit price so amounts and percentages can be checked together.';
      return out;
    }
    var tol = pctItems; // percentage rows can each round by 1 fil
    var diff = sumF - price;
    if (Math.abs(diff) <= tol) {
      out.status = 'match';
      out.ok = true;
      out.msg = 'Schedule totals ' + U.fmtAED(sumF) + ', matching the unit price.';
    } else if (diff < 0) {
      out.status = 'under';
      out.msg =
        'Schedule totals ' +
        U.fmtAED(sumF) +
        ' — ' +
        U.fmtAED(-diff) +
        ' of the ' +
        U.fmtAED(price) +
        ' unit price isn’t scheduled. Nothing is changed automatically.';
    } else {
      out.status = 'over';
      out.msg =
        'Schedule totals ' +
        U.fmtAED(sumF) +
        ', ' +
        U.fmtAED(diff) +
        ' more than the unit price. Check whether the booking is counted twice.';
    }
    return out;
  };

  /** Long-term rent summary */
  E08.pricing.rent = function (st) {
    var d = st.d,
      rent = money(d.annualRent);
    var out = { rent: rent, payLines: [], oneTime: [], other: [], deposit: null };
    (d.cheques || [])
      .slice()
      .sort(function (a, b) {
        return a - b;
      })
      .forEach(function (n) {
        n = Number(n);
        var own = money((st.cheqAmts || {})[n]);
        var total = own != null ? own : rent;
        if (total == null) return;
        out.payLines.push({
          k: n + (n === 1 ? ' cheque' : ' cheques') + (own != null ? ' (own price)' : ''),
          v:
            n === 1
              ? U.fmtAED(total) + ' / year — one payment for the year'
              : U.fmtAED(total) + ' / year — ' + n + ' payments of about ' + U.fmtAED(Math.round(total / n)),
        });
      });
    var dep = amt(d, 'deposit', 'depositBasis', rent);
    if (dep.ok && !dep.blank)
      out.deposit =
        dep.fils != null
          ? U.fmtAED(dep.fils) + (dep.bp != null ? ' (' + U.fmtBp(dep.bp) + ' of annual rent)' : '')
          : U.fmtBp(dep.bp) + ' of annual rent';
    var cm = amt(d, 'commission', 'commBasis', rent);
    if (cm.ok && !cm.blank)
      out.oneTime.push({
        k: 'Brokerage fee',
        v:
          cm.fils != null
            ? U.fmtAED(cm.fils) + (cm.bp != null ? ' (' + U.fmtBp(cm.bp) + ')' : '')
            : U.fmtBp(cm.bp) + ' of annual rent',
      });
    var up = money(d.upfrontFees);
    if (up != null) out.oneTime.push({ k: U.trim1(d.upfrontNote) || 'Other upfront fees', v: U.fmtAED(up) });
    if (U.trim1(d.otherCharges)) out.other.push({ k: 'Other charges', v: U.trim1(d.otherCharges) });
    (st.extraTerms || []).forEach(function (t) {
      if (!U.trim1(t.label)) return;
      var m = money(t.amount);
      out.other.push({
        k: U.trim1(t.label),
        v:
          (m != null ? U.fmtAED(m) : 'Amount not stated') +
          (t.freq ? ' · ' + t.freq : '') +
          (t.payer ? ' · paid by ' + t.payer : ''),
      });
    });
    return out;
  };

  /** Off-plan resale: payable now vs future developer payments */
  E08.pricing.resale = function (st) {
    var d = st.d;
    var ask = money(d.askingPrice),
      seller = money(d.payToSeller),
      outst = money(d.outstanding),
      tr = money(d.transferCharges);
    var paid = money(d.paidToDev),
      orig = money(d.originalPrice),
      next = money(d.nextInstAmt);
    var out = { lines: [], warnings: [], total: null, totalNote: '' };
    var payNow = seller != null ? seller : d.priceBasis === 'seller' ? ask : null;
    out.payNow = payNow;
    out.future = outst;
    if (tr != null) out.transfer = { fils: tr, payer: d.transferPayer || '' };
    if (d.priceBasis === 'incl') {
      out.total = ask;
      out.totalNote =
        'Asking price, which you stated includes the outstanding developer balance' +
        (tr != null && d.transferPayer === 'buyer' ? '; transfer charges are additional' : '') +
        '.';
      if (ask != null && seller != null && outst != null && Math.abs(seller + outst - ask) > 0)
        out.warnings.push(
          'Payable to seller (' +
            U.fmtAED(seller) +
            ') + outstanding balance (' +
            U.fmtAED(outst) +
            ') = ' +
            U.fmtAED(seller + outst) +
            ', which differs from the asking price (' +
            U.fmtAED(ask) +
            ').',
        );
    } else if (d.priceBasis === 'seller') {
      if (ask != null && outst != null) {
        out.total = ask + outst;
        out.totalNote =
          'Asking price paid to the seller plus the outstanding developer balance' +
          (tr != null && d.transferPayer === 'buyer' ? '; transfer charges are additional' : '') +
          '.';
      }
      if (ask != null && seller != null && seller !== ask)
        out.warnings.push(
          'You said the asking price is paid to the seller, but “Amount payable to seller” is ' +
            U.fmtAED(seller) +
            ' and the asking price is ' +
            U.fmtAED(ask) +
            '.',
        );
    } else {
      out.totalNote =
        'Not calculated — choose what the asking price covers first. Asking price and outstanding balance are never added automatically.';
    }
    if (orig != null && paid != null && outst != null && paid + outst !== orig)
      out.warnings.push(
        'Paid to developer + outstanding balance (' +
          U.fmtAED(paid + outst) +
          ') differs from the original price (' +
          U.fmtAED(orig) +
          '). This may be correct if fees or discounts apply.',
      );
    if (next != null && outst != null && next > outst)
      out.warnings.push('The next instalment is larger than the outstanding balance.');
    return out;
  };
})();

/* validation.js — validates ONLY active fields and active widgets.
 * Returns {errs, warns}: errs block Continue/submit, warns never block.
 */
(function () {
  'use strict';
  var U = E08.util;

  function lc(s) {
    return s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
  }
  function reqMessage(f, kind, c, d) {
    var l = E08.labelOf(f, c, d);
    if (kind === 'seg' || kind === 'select' || kind === 'multi') return 'Select ' + lc(l) + '.';
    return 'Enter ' + lc(l) + '.';
  }

  E08.validateListing = function (st) {
    var d = st.d,
      c = E08.ctxOf(d),
      errs = {},
      warns = {},
      today = U.todayISO();
    var active = E08.activeFieldKeys(c, d),
      on = {};
    active.forEach(function (k) {
      on[k] = true;
    });

    active.forEach(function (key) {
      var f = E08.FIELDS[key],
        v = d[key],
        kind = E08.effKind(f, d),
        req = E08.isReq(f, c, d),
        n;
      if (kind === 'check') {
        if (req && !v) errs[key] = f.reqMsg || 'Confirm this to continue.';
        return;
      }
      if (U.isBlank(v)) {
        if (req) errs[key] = f.reqMsg || reqMessage(f, kind, c, d);
        return;
      }
      var s = kind === 'area' ? String(v.raw).trim() : Array.isArray(v) ? '' : String(v).trim();
      switch (kind) {
        case 'money':
          if (/^-/.test(s)) {
            errs[key] = 'Amounts can’t be negative.';
            break;
          }
          n = U.parseMoney(s);
          if (isNaN(n)) errs[key] = 'Enter an amount in AED using digits, e.g. 1250000 or 1250000.50.';
          else if (n === 0 && !f.zeroOk) errs[key] = 'Enter an amount above zero, or leave this blank.';
          break;
        case 'pct':
          if (/^-/.test(s)) {
            errs[key] = 'Percentages can’t be negative.';
            break;
          }
          n = U.parsePct(s);
          if (isNaN(n)) errs[key] = 'Enter a percentage with up to 2 decimals, e.g. 10 or 12.5.';
          else if (n > 10000) errs[key] = 'A percentage can’t be more than 100%.';
          break;
        case 'int':
          n = U.parseIntSafe(s);
          if (isNaN(n)) errs[key] = 'Enter a whole number (0 or more).';
          break;
        case 'dec':
          n = U.parseDec(s);
          if (n == null || isNaN(n)) errs[key] = 'Enter a number, e.g. 12.5.';
          else if (n < 0 && key !== 'lat' && key !== 'lng') errs[key] = 'This can’t be negative.';
          break;
        case 'year':
          if (!/^\d{4}$/.test(s)) errs[key] = 'Enter a 4-digit year.';
          else if (Number(s) < 1900) errs[key] = 'Enter a year from 1900 onwards.';
          break;
        case 'date':
          if (!U.validDate(s)) errs[key] = 'Enter a valid date.';
          break;
        case 'area':
          if (/^-/.test(s)) {
            errs[key] = 'Areas can’t be negative.';
            break;
          }
          n = U.parseDec(s);
          if (n == null || isNaN(n)) errs[key] = 'Enter the area as a number, e.g. 1250 or 116.13.';
          else if (n === 0) errs[key] = 'Enter an area above zero, or leave this blank.';
          break;
        case 'url':
          if (!U.safeHttpsUrl(s)) errs[key] = 'Enter a full link starting with https://';
          break;
        case 'email':
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) errs[key] = 'Enter a valid email address.';
          break;
        case 'phone':
          var digits = s.replace(/\D/g, '');
          if (!/^\+?[0-9 ()-]+$/.test(s) || digits.length < 7 || digits.length > 15)
            errs[key] = 'Enter a phone number with country code, e.g. +971 50 123 4567.';
          break;
        default:
          if (f.max && s.length > f.max) errs[key] = 'Keep this to ' + f.max.toLocaleString() + ' characters or fewer.';
      }
    });

    /* ---------- Cross-field rules ---------- */
    function set(k, m) {
      if (on[k] && !errs[k]) errs[k] = m;
    }
    function warn(k, m) {
      if (on[k] && !errs[k]) warns[k] = m;
    }
    if (c.rentOff)
      set(
        'devStatus',
        'Off-plan units can’t be advertised for rent in this version because they can’t be occupied yet. List it for sale, or choose Ready if construction is complete.',
      );
    if (c.tenanted && d.possession === 'now')
      set(
        'possession',
        'The property is tenanted, so it can’t be offered as available now without conditions. Choose “Subject to tenancy”, “Vacant on transfer” or an expected date.',
      );
    if (c.tenanted && d.possession === 'on_transfer')
      warn('possession', 'Tenanted but offered vacant on transfer — make sure the tenancy actually ends by transfer.');
    if (c.ready && d.occupancy === 'vacant' && d.possession === 'subject_tenancy')
      set('possession', 'Occupancy is Vacant, but possession is “Subject to tenancy”.');
    if (/^\d{4}$/.test(d.completionYear || '') && Number(d.completionYear) > U.CUR_YEAR)
      set(
        'completionYear',
        'Completion year is in the future. If construction isn’t complete, set the property to Off-plan in Classification.',
      );
    if (c.off && d.handoverY && d.handoverQ) {
      var hy = Number(d.handoverY),
        hq = Number(d.handoverQ);
      if (hy < U.CUR_YEAR || (hy === U.CUR_YEAR && hq < U.CUR_Q))
        set(
          'handoverQ',
          'This quarter has already passed. If the property is complete, choose Ready / Completed in Classification.',
        );
      if (U.validDate(d.handoverDate)) {
        if (Number(d.handoverDate.slice(0, 4)) !== hy || U.quarterOf(d.handoverDate) !== hq)
          set(
            'handoverDate',
            'This date falls in Q' +
              U.quarterOf(d.handoverDate) +
              ' ' +
              d.handoverDate.slice(0, 4) +
              ', which doesn’t match the expected handover quarter.',
          );
      }
    }
    if (c.off && U.validDate(d.handoverDate) && d.handoverDate < today)
      set(
        'handoverDate',
        'A past handover date conflicts with Off-plan status. If it was handed over, choose Ready / Completed.',
      );
    if (c.off && U.parsePct(d.progressPct) === 10000)
      warn('progressPct', 'Reported as 100% — if construction is complete, switch to Ready / Completed.');
    if (U.validDate(d.progressDate) && d.progressDate > today)
      set('progressDate', 'The update date can’t be in the future.');
    ['bedroomsCustom', 'bathroomsCustom', 'parkingCustom'].forEach(function (k) {
      var n = U.parseIntSafe(d[k]);
      if (n != null && !isNaN(n) && n <= 10) set(k, 'Use the list above for 10 or fewer.');
    });
    if (U.validDate(d.leaseExpiry) && d.leaseExpiry < today) set('leaseExpiry', 'This lease expiry date has passed.');
    if (U.validDate(d.possessionDate) && d.possessionDate < today)
      warn('possessionDate', 'This date has passed — choose “Available now” if that applies.');
    if (U.validDate(d.availableFrom) && d.availableFrom < today)
      warn('availableFrom', 'This date has passed — choose “Available now” if the property is available.');
    if (U.validDate(d.tenancyExpiry) && d.tenancyExpiry < today)
      warn('tenancyExpiry', 'This tenancy expiry date has passed. Update the occupancy if the tenant has left.');
    ['deposit', 'commission', 'booking'].forEach(function (k) {
      var f = E08.FIELDS[k];
      if (d[f.basisKey] === 'pct') {
        var bp = U.parsePct(d[k]);
        if (bp != null && !isNaN(bp) && bp > 10000) set(k, 'A percentage can’t be more than 100%.');
      }
    });
    if (d.commBasis === 'pct') {
      var cbp = U.parsePct(d.commission);
      if (cbp != null && !isNaN(cbp) && cbp > 1000 && cbp <= 10000)
        warn('commission', 'This is unusually high — please double-check.');
    }
    if (d.bookingBasis === 'aed') {
      var bk = U.parseMoney(d.booking),
        up = U.parseMoney(d.unitPrice);
      if (bk > 0 && up > 0 && bk > up) set('booking', 'The booking amount is larger than the unit price.');
    }
    if (U.validDate(d.permitExpiry) && d.permitExpiry < today)
      set('permitExpiry', 'This permit has expired. Renew it before submitting.');
    if (U.validDate(d.authExpiry) && d.authExpiry < today) set('authExpiry', 'This authorization has expired.');
    if (U.validDate(d.incentiveExpiry) && d.incentiveExpiry < today)
      warn('incentiveExpiry', 'This incentive has expired — remove it or update the date.');
    if (on.floorDisplay && d.floorDisplay === 'exact' && U.isBlank(d.floorNo))
      set('floorDisplay', 'Add the exact floor number in Location, or choose Floor band or Hidden.');
    if (on.floorDisplay && d.floorDisplay === 'band' && U.isBlank(d.floorBand))
      set('floorDisplay', 'Choose a public floor band in Property details, or choose Hidden.');
    ['title', 'description', 'altTitle', 'altDesc', 'locHighlights'].forEach(function (k) {
      if (on[k] && U.CONTACT_RE.test(d[k] || ''))
        set(
          k,
          'Remove phone numbers, emails, links or messaging handles — buyers contact you through the listing’s contact panel.',
        );
    });
    if (on.title && d.title && d.title.length > 12 && d.title === d.title.toUpperCase() && /[A-Z]/.test(d.title))
      warn('title', 'All-capital titles are harder to read. Consider sentence case.');
    var hasLat = !U.isBlank(d.lat),
      hasLng = !U.isBlank(d.lng);
    if (hasLat !== hasLng) set(hasLat ? 'lng' : 'lat', 'Enter both latitude and longitude, or neither.');
    var la = U.parseDec(d.lat),
      ln = U.parseDec(d.lng);
    if (la != null && !isNaN(la) && (la < -90 || la > 90)) set('lat', 'Latitude must be between −90 and 90.');
    if (ln != null && !isNaN(ln) && (ln < -180 || ln > 180)) set('lng', 'Longitude must be between −180 and 180.');
    if (
      la != null &&
      ln != null &&
      !isNaN(la) &&
      !isNaN(ln) &&
      !errs.lat &&
      !errs.lng &&
      (la < 24.6 || la > 25.45 || ln < 54.85 || ln > 55.75)
    )
      warn('lat', 'These coordinates look outside Dubai. Please double-check.');
    if (on.tourUrl && !U.isBlank(d.tourUrl) && !errs.tourUrl && !U.parseTourUrl(d.tourUrl))
      set('tourUrl', 'Only Matterport (my.matterport.com/show/?m=…) and Kuula links are supported.');
    if (on.permitUrl && !errs.permitUrl && d.permitUrl && !/^http/.test(d.permitUrl))
      set('permitUrl', 'Enter a full link starting with https://');

    /* ---------- Widgets (only if their section is active) ---------- */
    var kinds = {};
    E08.STEPS.forEach(function (stp, i) {
      E08.activeSections(i, c, d).forEach(function (s) {
        if (s.kind) kinds[s.kind] = s;
      });
    });

    if (kinds.community && !d.communityId) errs.community = 'Select the area / community from the list.';
    if (kinds.amen) {
      var unrev = Object.keys(st.amen || {}).filter(function (id) {
        return st.amen[id].inherited && !st.amen[id].reviewed;
      });
      if (unrev.length)
        errs.amen =
          'Review the ' +
          unrev.length +
          ' amenit' +
          (unrev.length === 1 ? 'y' : 'ies') +
          ' imported from the building record: confirm or remove each.';
    }
    if (kinds.custom) {
      var ce = E08.customErrors(st);
      var n1 = Object.keys(ce).length;
      if (n1) errs.custom = n1 + ' additional feature' + (n1 === 1 ? ' needs' : 's need') + ' attention.';
    }
    if (kinds.milestones) {
      var sc = E08.pricing.schedule(st),
        me = E08.milestoneErrors(st);
      if (Object.keys(me).length) errs.milestones = 'Complete each milestone: name, amount and when it is due.';
      else if (!sc.ok) errs.milestones = sc.msg;
    }
    if (kinds.cheques) {
      var bad = (d.cheques || []).filter(function (n) {
        var v = (st.cheqAmts || {})[n];
        if (U.isBlank(v)) return false;
        var m = U.parseMoney(v);
        return m == null || isNaN(m) || m === 0;
      });
      if (bad.length) errs.cheques = 'Enter cheque-arrangement amounts in AED using digits.';
    }
    if (kinds.extra) {
      var xe = (st.extraTerms || []).some(function (t) {
        return (
          !U.trim1(t.label) ||
          (!U.isBlank(t.amount) && (U.parseMoney(t.amount) == null || isNaN(U.parseMoney(t.amount))))
        );
      });
      if (xe) errs.extra = 'Each additional term needs a label, and amounts must be in AED digits.';
    }
    if (kinds.highlights) {
      var he = (st.highlights || []).some(function (h) {
        return U.CONTACT_RE.test(h.text || '') || (h.text || '').length > 120;
      });
      if (he) errs.highlights = 'Highlights must be 120 characters or fewer and contain no contact details or links.';
    }
    if (kinds.photos) {
      var ph = st.photos || [],
        present = ph.filter(function (p) {
          return !p.missing;
        }),
        missing = ph.length - present.length;
      if (missing)
        errs.photos =
          missing + ' photo' + (missing === 1 ? '' : 's') + ' must be reselected after reloading — or removed.';
      else if (!present.length) errs.photos = 'Add at least one photo of the property.';
      else if (
        !st.coverId ||
        !present.some(function (p) {
          return p.id === st.coverId;
        })
      )
        errs.photos = 'Choose a cover photo with “Set as cover”.';
      else if (
        c.ready &&
        !present.some(function (p) {
          return p.imgType === 'actual' || p.imgType === 'show_unit' || !p.imgType;
        })
      )
        errs.photos = 'Ready properties need at least one photo of the actual property, not only renders.';
      else if (present.length < E08.config.LIMITS.photos.recommendMin)
        warns.photos = 'Listings with 8–15 useful photos tend to get more enquiries.';
    }
    if (kinds.videos) {
      var vbad = (st.videos || []).some(function (v) {
        return (v.kind === 'file' && v.missing) || !U.trim1(v.title);
      });
      if (vbad) errs.videos = 'Give each video a title, and reselect any video that needs it after reloading.';
    }
    if (kinds.plans) {
      var pbad = (st.plans || []).some(function (p) {
        return p.missing || !U.trim1(p.name);
      });
      if (pbad) errs.plans = 'Name each floor plan’s layout, and reselect any file that needs it after reloading.';
    }
    return { errs: errs, warns: warns };
  };

  E08.customErrors = function (st) {
    var out = {},
      names = {},
      std = {};
    Object.keys(E08.AMENITY).forEach(function (id) {
      std[U.norm(E08.AMENITY[id].l)] = id;
    });
    (st.custom || []).forEach(function (r) {
      var n = U.norm(U.trim1(r.name));
      if (!n) {
        out[r.id] = 'Enter a feature name, or remove this row.';
        return;
      }
      if (U.trim1(r.name).length > 60) {
        out[r.id] = 'Keep the name to 60 characters or fewer.';
        return;
      }
      if ((r.desc || '').length > 160) {
        out[r.id] = 'Keep the description to 160 characters or fewer.';
        return;
      }
      if (U.CONTACT_RE.test(r.name + ' ' + (r.desc || ''))) {
        out[r.id] = 'Remove contact details or links.';
        return;
      }
      if (std[n]) {
        out[r.id] = (st.amen || {})[std[n]]
          ? 'Already selected under standard amenities.'
          : 'This matches the standard amenity “' + E08.AMENITY[std[n]].l + '” — select it above instead.';
        return;
      }
      if (names[n]) {
        out[r.id] = 'Duplicate of another additional feature.';
        return;
      }
      if (r.editing) {
        out[r.id] = 'Save or remove this feature.';
      }
      names[n] = true;
    });
    return out;
  };

  E08.milestoneErrors = function (st) {
    var out = {};
    (st.milestones || []).forEach(function (r) {
      var m = [];
      if (!U.trim1(r.name)) m.push('name');
      var ok =
        r.mode === 'pct'
          ? (function () {
              var b = U.parsePct(r.value);
              return b != null && !isNaN(b) && b > 0 && b <= 10000;
            })()
          : (function () {
              var a = U.parseMoney(r.value);
              return a != null && !isNaN(a) && a > 0;
            })();
      if (!ok) m.push(r.mode === 'pct' ? 'a percentage' : 'an AED amount');
      if (!r.trigger) m.push('when it is due');
      else if (r.trigger === 'date' && !U.validDate(r.when)) m.push('a valid date');
      else if (r.trigger === 'construction' && !U.trim1(r.when)) m.push('the construction milestone');
      if (r.trigger === 'post' && st.d.postHandover !== 'yes') m.push('“Post-handover payment plan: Yes” above');
      if (m.length) out[r.id] = 'Add ' + m.join(', ') + '.';
    });
    return out;
  };
})();

// This application accepts existing community suggestions and manual building names.
E08.FIELDS.developer.help = 'Enter the developer name as shown on the property or project documents.';
export const listingSchema = E08;
