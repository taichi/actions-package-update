declare module "convict-format-with-validator" {
  import convict from "convict";

  export var email: convict.Format;
  export var ipaddress: convict.Format;
  export var url: convict.Format;
}
