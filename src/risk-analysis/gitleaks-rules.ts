export interface RegexRule {
  id: string;
  pattern: RegExp;
  message: string;
  severity: 'high' | 'medium' | 'low' | 'critical';
  category?: string;
}

// Predefined regex rules for sensitive data (based on Gitleaks config)
export const SENSITIVE_PATTERNS: RegexRule[] = [
  {
    id: 'gitlab-pat',
    pattern: /glpat-[0-9a-zA-Z\-\_]{20}/,
    message: 'GitLab Personal Access Token',
    severity: 'critical',
    category: 'GitLab',
  },
  {
    id: 'aws-access-token',
    pattern:
      /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/,
    message: 'AWS Access Token',
    severity: 'critical',
    category: 'AWS',
  },
  {
    id: 'aws-secret-key',
    pattern:
      /(aws[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}[0-9a-zA-Z\/+]{40}/i,
    message: 'AWS Secret Key',
    severity: 'critical',
    category: 'AWS',
  },
  {
    id: 'aws-mws-key',
    pattern:
      /amzn\.mws\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
    message: 'AWS MWS Key',
    severity: 'critical',
    category: 'AWS',
  },
  {
    id: 'PKCS8-PK',
    pattern: /-----BEGIN PRIVATE KEY-----/,
    message: 'PKCS8 Private Key',
    severity: 'critical',
    category: 'Private Keys',
  },
  {
    id: 'RSA-PK',
    pattern: /-----BEGIN RSA PRIVATE KEY-----/,
    message: 'RSA Private Key',
    severity: 'critical',
    category: 'Private Keys',
  },
  {
    id: 'OPENSSH-PK',
    pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/,
    message: 'OpenSSH Private Key',
    severity: 'critical',
    category: 'Private Keys',
  },
  {
    id: 'PGP-PK',
    pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/,
    message: 'PGP Private Key',
    severity: 'critical',
    category: 'Private Keys',
  },
  {
    id: 'github-pat',
    pattern: /ghp_[0-9a-zA-Z]{36}/,
    message: 'GitHub Personal Access Token',
    severity: 'critical',
    category: 'GitHub',
  },
  {
    id: 'github-oauth',
    pattern: /gho_[0-9a-zA-Z]{36}/,
    message: 'GitHub OAuth Access Token',
    severity: 'critical',
    category: 'GitHub',
  },
  {
    id: 'SSH-DSA-PK',
    pattern: /-----BEGIN DSA PRIVATE KEY-----/,
    message: 'SSH (DSA) Private Key',
    severity: 'critical',
    category: 'Private Keys',
  },
  {
    id: 'SSH-EC-PK',
    pattern: /-----BEGIN EC PRIVATE KEY-----/,
    message: 'SSH (EC) Private Key',
    severity: 'critical',
    category: 'Private Keys',
  },
  {
    id: 'github-app-token',
    pattern: /(ghu|ghs)_[0-9a-zA-Z]{36}/,
    message: 'GitHub App Token',
    severity: 'critical',
    category: 'GitHub',
  },
  {
    id: 'github-refresh-token',
    pattern: /ghr_[0-9a-zA-Z]{76}/,
    message: 'GitHub Refresh Token',
    severity: 'critical',
    category: 'GitHub',
  },
  {
    id: 'shopify-shared-secret',
    pattern: /shpss_[a-fA-F0-9]{32}/,
    message: 'Shopify Shared Secret',
    severity: 'critical',
    category: 'Shopify',
  },
  {
    id: 'shopify-access-token',
    pattern: /shpat_[a-fA-F0-9]{32}/,
    message: 'Shopify Access Token',
    severity: 'critical',
    category: 'Shopify',
  },
  {
    id: 'shopify-custom-access-token',
    pattern: /shpca_[a-fA-F0-9]{32}/,
    message: 'Shopify Custom App Access Token',
    severity: 'critical',
    category: 'Shopify',
  },
  {
    id: 'shopify-private-app-access-token',
    pattern: /shppa_[a-fA-F0-9]{32}/,
    message: 'Shopify Private App Access Token',
    severity: 'critical',
    category: 'Shopify',
  },
  {
    id: 'slack-access-token',
    pattern: /xox[baprs]-([0-9a-zA-Z]{10,48})?/,
    message: 'Slack Access Token',
    severity: 'critical',
    category: 'Slack',
  },
  {
    id: 'stripe-access-token',
    pattern: /(sk|pk)_(test|live)_[0-9a-z]{10,32}/i,
    message: 'Stripe Access Token',
    severity: 'critical',
    category: 'Stripe',
  },
  {
    id: 'pypi-upload-token',
    pattern: /pypi-AgEIcHlwaS5vcmc[A-Za-z0-9\-_]{50,1000}/,
    message: 'PyPI Upload Token',
    severity: 'critical',
    category: 'PyPI',
  },
  {
    id: 'gcp-service-account',
    pattern: /"type": "service_account"/,
    message: 'GCP Service Account',
    severity: 'critical',
    category: 'GCP',
  },
  {
    id: 'heroku-api-key',
    pattern:
      /(heroku[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12})['"]/i,
    message: 'Heroku API Key',
    severity: 'critical',
    category: 'Heroku',
  },
  {
    id: 'slack-web-hook',
    pattern:
      /https:\/\/hooks.slack.com\/services\/T[a-zA-Z0-9_]{8}\/B[a-zA-Z0-9_]{8,12}\/[a-zA-Z0-9_]{24}/,
    message: 'Slack Webhook',
    severity: 'critical',
    category: 'Slack',
  },
  {
    id: 'twilio-api-key',
    pattern: /SK[0-9a-fA-F]{32}/,
    message: 'Twilio API Key',
    severity: 'critical',
    category: 'Twilio',
  },
  {
    id: 'age-secret-key',
    pattern: /AGE-SECRET-KEY-1[QPZRY9X8GF2TVDW0S3JN54KHCE6MUA7L]{58}/,
    message: 'Age Secret Key',
    severity: 'critical',
    category: 'Age',
  },
  {
    id: 'facebook-token',
    pattern:
      /(facebook[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([a-f0-9]{32})['"]/i,
    message: 'Facebook Token',
    severity: 'critical',
    category: 'Facebook',
  },
  {
    id: 'twitter-token',
    pattern:
      /(twitter[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([a-f0-9]{35,44})['"]/i,
    message: 'Twitter Token',
    severity: 'critical',
    category: 'Twitter',
  },
  {
    id: 'adobe-client-id',
    pattern:
      /(adobe[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([a-f0-9]{32})['"]/i,
    message: 'Adobe Client ID',
    severity: 'critical',
    category: 'Adobe',
  },
  {
    id: 'adobe-client-secret',
    pattern: /(p8e-)[a-z0-9]{32}/i,
    message: 'Adobe Client Secret',
    severity: 'critical',
    category: 'Adobe',
  },
  {
    id: 'alibaba-access-key-id',
    pattern: /(LTAI)[a-z0-9]{20}/i,
    message: 'Alibaba AccessKey ID',
    severity: 'critical',
    category: 'Alibaba',
  },
  {
    id: 'alibaba-secret-key',
    pattern:
      /(alibaba[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([a-z0-9]{30})['"]/i,
    message: 'Alibaba Secret Key',
    severity: 'critical',
    category: 'Alibaba',
  },
  {
    id: 'asana-client-id',
    pattern:
      /(asana[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([0-9]{16})['"]/i,
    message: 'Asana Client ID',
    severity: 'critical',
    category: 'Asana',
  },
  {
    id: 'asana-client-secret',
    pattern:
      /(asana[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([a-z0-9]{32})['"]/i,
    message: 'Asana Client Secret',
    severity: 'critical',
    category: 'Asana',
  },
  {
    id: 'atlassian-api-token',
    pattern:
      /(atlassian[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([a-z0-9]{24})['"]/i,
    message: 'Atlassian API Token',
    severity: 'critical',
    category: 'Atlassian',
  },
  {
    id: 'bitbucket-client-id',
    pattern:
      /(bitbucket[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([a-z0-9]{32})['"]/i,
    message: 'Bitbucket Client ID',
    severity: 'critical',
    category: 'Bitbucket',
  },
  {
    id: 'bitbucket-client-secret',
    pattern:
      /(bitbucket[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([a-z0-9_\-]{64})['"]/i,
    message: 'Bitbucket Client Secret',
    severity: 'critical',
    category: 'Bitbucket',
  },
  {
    id: 'beamer-api-token',
    pattern:
      /(beamer[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"](b_[a-z0-9=_\-]{44})['"]/i,
    message: 'Beamer API Token',
    severity: 'critical',
    category: 'Beamer',
  },
  {
    id: 'clojars-api-token',
    pattern: /(CLOJARS_)[a-z0-9]{60}/i,
    message: 'Clojars API Token',
    severity: 'critical',
    category: 'Clojars',
  },
  {
    id: 'contentful-delivery-api-token',
    pattern:
      /(contentful[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([a-z0-9\-=_]{43})['"]/i,
    message: 'Contentful Delivery API Token',
    severity: 'critical',
    category: 'Contentful',
  },
  {
    id: 'databricks-api-token',
    pattern: /dapi[a-h0-9]{32}/,
    message: 'Databricks API Token',
    severity: 'critical',
    category: 'Databricks',
  },
  {
    id: 'discord-api-token',
    pattern:
      /(discord[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([a-h0-9]{64})['"]/i,
    message: 'Discord API Key',
    severity: 'critical',
    category: 'Discord',
  },
  {
    id: 'discord-client-id',
    pattern:
      /(discord[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([0-9]{18})['"]/i,
    message: 'Discord Client ID',
    severity: 'critical',
    category: 'Discord',
  },
  {
    id: 'discord-client-secret',
    pattern:
      /(discord[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([a-z0-9=_\-]{32})['"]/i,
    message: 'Discord Client Secret',
    severity: 'critical',
    category: 'Discord',
  },
  {
    id: 'doppler-api-token',
    pattern: /['"](dp\.pt\.)[a-z0-9]{43}['"]/i,
    message: 'Doppler API Token',
    severity: 'critical',
    category: 'Doppler',
  },
  {
    id: 'dropbox-api-secret',
    pattern:
      /(dropbox[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([a-z0-9]{15})['"]/i,
    message: 'Dropbox API Secret',
    severity: 'critical',
    category: 'Dropbox',
  },
  {
    id: 'dropbox-short-lived-api-token',
    pattern:
      /(dropbox[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"](sl\.[a-z0-9\-=_]{135})['"]/i,
    message: 'Dropbox Short Lived API Token',
    severity: 'critical',
    category: 'Dropbox',
  },
  {
    id: 'dropbox-long-lived-api-token',
    pattern:
      /(dropbox[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"][a-z0-9]{11}(AAAAAAAAAA)[a-z0-9\-_=]{43}['"]/i,
    message: 'Dropbox Long Lived API Token',
    severity: 'critical',
    category: 'Dropbox',
  },
  {
    id: 'duffel-api-token',
    pattern: /['"]duffel_(test|live)_[a-z0-9_-]{43}['"]/i,
    message: 'Duffel API Token',
    severity: 'critical',
    category: 'Duffel',
  },
  {
    id: 'dynatrace-api-token',
    pattern: /['"]dt0c01\.[a-z0-9]{24}\.[a-z0-9]{64}['"]/i,
    message: 'Dynatrace API Token',
    severity: 'critical',
    category: 'Dynatrace',
  },
  {
    id: 'easypost-api-token',
    pattern: /['"]EZAK[a-z0-9]{54}['"]/i,
    message: 'EasyPost API Token',
    severity: 'critical',
    category: 'EasyPost',
  },
  {
    id: 'easypost-test-api-token',
    pattern: /['"]EZTK[a-z0-9]{54}['"]/i,
    message: 'EasyPost Test API Token',
    severity: 'critical',
    category: 'EasyPost',
  },
  {
    id: 'fastly-api-token',
    pattern:
      /(fastly[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([a-z0-9\-=_]{32})['"]/i,
    message: 'Fastly API Token',
    severity: 'critical',
    category: 'Fastly',
  },
  {
    id: 'finicity-client-secret',
    pattern:
      /(finicity[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([a-z0-9]{20})['"]/i,
    message: 'Finicity Client Secret',
    severity: 'critical',
    category: 'Finicity',
  },
  {
    id: 'finicity-api-token',
    pattern:
      /(finicity[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([a-f0-9]{32})['"]/i,
    message: 'Finicity API Token',
    severity: 'critical',
    category: 'Finicity',
  },
  {
    id: 'flutterwave-public-key',
    pattern: /FLWPUBK_TEST-[a-h0-9]{32}-X/i,
    message: 'Flutterwave Public Key',
    severity: 'critical',
    category: 'Flutterwave',
  },
  {
    id: 'flutterwave-secret-key',
    pattern: /FLWSECK_TEST-[a-h0-9]{32}-X/i,
    message: 'Flutterwave Secret Key',
    severity: 'critical',
    category: 'Flutterwave',
  },
  {
    id: 'flutterwave-enc-key',
    pattern: /FLWSECK_TEST[a-h0-9]{12}/,
    message: 'Flutterwave Encrypted Key',
    severity: 'critical',
    category: 'Flutterwave',
  },
  {
    id: 'frameio-api-token',
    pattern: /fio-u-[a-z0-9\-_=]{64}/i,
    message: 'Frame.io API Token',
    severity: 'critical',
    category: 'Frame.io',
  },
  {
    id: 'gocardless-api-token',
    pattern: /['"]live_[a-z0-9\-_=]{40}['"]/i,
    message: 'GoCardless API Token',
    severity: 'critical',
    category: 'GoCardless',
  },
  {
    id: 'grafana-api-token',
    pattern: /['"]eyJrIjoi[a-z0-9\-_=]{72,92}['"]/i,
    message: 'Grafana API Token',
    severity: 'critical',
    category: 'Grafana',
  },
  {
    id: 'hashicorp-tf-api-token',
    pattern: /['"][a-z0-9]{14}\.atlasv1\.[a-z0-9\-_=]{60,70}['"]/i,
    message: 'HashiCorp Terraform API Token',
    severity: 'critical',
    category: 'HashiCorp',
  },
  {
    id: 'hubspot-api-token',
    pattern:
      /(hubspot[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([a-h0-9]{8}-[a-h0-9]{4}-[a-h0-9]{4}-[a-h0-9]{4}-[a-h0-9]{12})['"]/i,
    message: 'HubSpot API Token',
    severity: 'critical',
    category: 'HubSpot',
  },
  {
    id: 'intercom-api-token',
    pattern:
      /(intercom[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([a-z0-9=_]{60})['"]/i,
    message: 'Intercom API Token',
    severity: 'critical',
    category: 'Intercom',
  },
  {
    id: 'intercom-client-secret',
    pattern:
      /(intercom[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([a-h0-9]{8}-[a-h0-9]{4}-[a-h0-9]{4}-[a-h0-9]{4}-[a-h0-9]{12})['"]/i,
    message: 'Intercom Client Secret',
    severity: 'critical',
    category: 'Intercom',
  },
  {
    id: 'ionic-api-token',
    pattern:
      /(ionic[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"](ion_[a-z0-9]{42})['"]/i,
    message: 'Ionic API Token',
    severity: 'critical',
    category: 'Ionic',
  },
  {
    id: 'linear-api-token',
    pattern: /lin_api_[a-z0-9]{40}/i,
    message: 'Linear API Token',
    severity: 'critical',
    category: 'Linear',
  },
  {
    id: 'linear-client-secret',
    pattern:
      /(linear[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([a-f0-9]{32})['"]/i,
    message: 'Linear Client Secret',
    severity: 'critical',
    category: 'Linear',
  },
  {
    id: 'lob-api-key',
    pattern:
      /(lob[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]((live|test)_[a-f0-9]{35})['"]/i,
    message: 'Lob API Key',
    severity: 'critical',
    category: 'Lob',
  },
  {
    id: 'lob-pub-api-key',
    pattern:
      /(lob[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]((test|live)_pub_[a-f0-9]{31})['"]/i,
    message: 'Lob Publishable API Key',
    severity: 'critical',
    category: 'Lob',
  },
  {
    id: 'mailchimp-api-key',
    pattern:
      /(mailchimp[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([a-f0-9]{32}-us20)['"]/i,
    message: 'Mailchimp API Key',
    severity: 'critical',
    category: 'Mailchimp',
  },
  {
    id: 'mailgun-private-api-token',
    pattern:
      /(mailgun[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"](key-[a-f0-9]{32})['"]/i,
    message: 'Mailgun Private API Token',
    severity: 'critical',
    category: 'Mailgun',
  },
  {
    id: 'mailgun-pub-key',
    pattern:
      /(mailgun[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"](pubkey-[a-f0-9]{32})['"]/i,
    message: 'Mailgun Public Key',
    severity: 'critical',
    category: 'Mailgun',
  },
  {
    id: 'mailgun-signing-key',
    pattern:
      /(mailgun[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([a-h0-9]{32}-[a-h0-9]{8}-[a-h0-9]{8})['"]/i,
    message: 'Mailgun Signing Key',
    severity: 'critical',
    category: 'Mailgun',
  },
  {
    id: 'mapbox-api-token',
    pattern: /(pk\.[a-z0-9]{60}\.[a-z0-9]{22})/i,
    message: 'Mapbox API Token',
    severity: 'critical',
    category: 'Mapbox',
  },
  {
    id: 'messagebird-api-token',
    pattern:
      /(messagebird[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([a-z0-9]{25})['"]/i,
    message: 'MessageBird API Token',
    severity: 'critical',
    category: 'MessageBird',
  },
  {
    id: 'messagebird-client-id',
    pattern:
      /(messagebird[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([a-h0-9]{8}-[a-h0-9]{4}-[a-h0-9]{4}-[a-h0-9]{4}-[a-h0-9]{12})['"]/i,
    message: 'MessageBird Client ID',
    severity: 'critical',
    category: 'MessageBird',
  },
  {
    id: 'new-relic-user-api-key',
    pattern: /['"](NRAK-[A-Z0-9]{27})['"]/,
    message: 'New Relic User API Key',
    severity: 'critical',
    category: 'New Relic',
  },
  {
    id: 'new-relic-user-api-id',
    pattern:
      /(newrelic[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([A-Z0-9]{64})['"]/i,
    message: 'New Relic User API ID',
    severity: 'critical',
    category: 'New Relic',
  },
  {
    id: 'new-relic-browser-api-token',
    pattern: /['"](NRJS-[a-f0-9]{19})['"]/,
    message: 'New Relic Browser API Token',
    severity: 'critical',
    category: 'New Relic',
  },
  {
    id: 'npm-access-token',
    pattern: /['"](npm_[a-z0-9]{36})['"]/i,
    message: 'NPM Access Token',
    severity: 'critical',
    category: 'NPM',
  },
  {
    id: 'planetscale-password',
    pattern: /pscale_pw_[a-z0-9\-_\.]{43}/i,
    message: 'PlanetScale Password',
    severity: 'critical',
    category: 'PlanetScale',
  },
  {
    id: 'planetscale-api-token',
    pattern: /pscale_tkn_[a-z0-9\-_\.]{43}/i,
    message: 'PlanetScale API Token',
    severity: 'critical',
    category: 'PlanetScale',
  },
  {
    id: 'postman-api-token',
    pattern: /PMAK-[a-f0-9]{24}\-[a-f0-9]{34}/i,
    message: 'Postman API Token',
    severity: 'critical',
    category: 'Postman',
  },
  {
    id: 'pulumi-api-token',
    pattern: /pul-[a-f0-9]{40}/,
    message: 'Pulumi API Token',
    severity: 'critical',
    category: 'Pulumi',
  },
  {
    id: 'rubygems-api-token',
    pattern: /rubygems_[a-f0-9]{48}/,
    message: 'Rubygems API Token',
    severity: 'critical',
    category: 'Rubygems',
  },
  {
    id: 'sendgrid-api-token',
    pattern: /SG\.[a-z0-9_\-\.]{66}/i,
    message: 'SendGrid API Token',
    severity: 'critical',
    category: 'SendGrid',
  },
  {
    id: 'sendinblue-api-token',
    pattern: /xkeysib-[a-f0-9]{64}\-[a-z0-9]{16}/i,
    message: 'Sendinblue API Token',
    severity: 'critical',
    category: 'Sendinblue',
  },
  {
    id: 'shippo-api-token',
    pattern: /shippo_(live|test)_[a-f0-9]{40}/,
    message: 'Shippo API Token',
    severity: 'critical',
    category: 'Shippo',
  },
  {
    id: 'linkedin-client-secret',
    pattern:
      /(linkedin[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([a-z]{16})['"]/i,
    message: 'LinkedIn Client Secret',
    severity: 'critical',
    category: 'LinkedIn',
  },
  {
    id: 'linkedin-client-id',
    pattern:
      /(linkedin[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([a-z0-9]{14})['"]/i,
    message: 'LinkedIn Client ID',
    severity: 'critical',
    category: 'LinkedIn',
  },
  {
    id: 'twitch-api-token',
    pattern:
      /(twitch[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([a-z0-9]{30})['"]/i,
    message: 'Twitch API Token',
    severity: 'critical',
    category: 'Twitch',
  },
  {
    id: 'typeform-api-token',
    pattern:
      /(typeform[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}(tfp_[a-z0-9\-_\.=]{59})/i,
    message: 'Typeform API Token',
    severity: 'critical',
    category: 'Typeform',
  },
  {
    id: 'generic-api-key',
    pattern:
      /((key|api[^Version]|token|secret|password)[a-z0-9_ .\-,]{0,25})(=|>|:=|\|\|:|<=|=>|:).{0,5}['"]([0-9a-zA-Z\-_=]{8,64})['"]/i,
    message: 'Generic API Key',
    severity: 'high',
    category: 'Generic',
  },
  {
    id: 'email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}/i,
    message: 'Email Address',
    severity: 'low',
    category: 'PII',
  },
  {
    id: 'ip-address',
    pattern:
      /((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.){3}(25[0-5]|(2[0-4]|1\d|[1-9]|)\d)/,
    message: 'IPv4 Address',
    severity: 'low',
    category: 'Infrastructure',
  },
];
