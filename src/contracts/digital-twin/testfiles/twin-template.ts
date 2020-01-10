/*
  Copyright (C) 2018-present evan GmbH.

  This program is free software: you can redistribute it and/or modify it
  under the terms of the GNU Affero General Public License, version 3,
  as published by the Free Software Foundation.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
  See the GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program. If not, see http://www.gnu.org/licenses/ or
  write to the Free Software Foundation, Inc., 51 Franklin Street,
  Fifth Floor, Boston, MA, 02110-1301 USA, or download the license from
  the following URL: https://evan.network/license/
*/

export default JSON.parse(`{
  "description": {
    "author": "sample author",
    "dbcpVersion": 2,
    "description": "Sample Twin Template",
    "i18n": {
      "de": {
        "description": "Beispiel für eine Vorlage eines Digitalen Zwillings.",
        "name": "Beispiel Vorlage"
      },
      "en": {
        "description": "Example of a template for a digital twin.",
        "name": "Sample Twin Template"
      }
    },
    "name": "sampletwin",
    "version": "1.0.0"
  },
  "plugins": {
    "plugin1": {
      "description": {
        "author": "sample author",
        "dbcpVersion": 2,
        "description": "Sample Twin Plugin 1",
        "i18n": {
          "de": {
            "dataset1": {
              "description": "Beschreibung Datenset",
              "name": "Datenset 1",
              "properties": {
                "prop1": {
                  "label": "Prop 1",
                  "placeholder": "Wert für Property 1 eingeben."
                },
                "prop2": {
                  "label": "Prop 2",
                  "placeholder": "Wert für Property 2 eingeben."
                }
              }
            },
            "description": "Beschreibung Container 1",
            "name": "Container 1"
          },
          "en": {
            "dataset1": {
              "description": "description data set",
              "name": "dataset 1",
              "properties": {
                "prop1": {
                  "label": "Prop 1.",
                  "placeholder": "Enter value for property 1."
                },
                "prop2": {
                  "label": "prop 2.",
                  "placeholder": "Enter value for property 2."
                }
              }
            },
            "description": "description container 1",
            "name": "Container 1"
          }
        },
        "name": "plugin1",
        "version": "1.0.0"
      },
      "template": {
        "properties": {
          "dataset1": {
            "dataSchema": {
              "$id": "dataset1_schema",
              "properties": {
                "prop1": {
                  "type": "string"
                },
                "prop2": {
                  "type": "string"
                }
              },
              "type": "object"
            },
            "permissions": {
              "0": [
                "set"
              ]
            },
            "type": "entry"
          },
          "dataset2": {
            "dataSchema": {
              "$id": "dataset2_schema",
              "properties": {
                "prop1": {
                  "type": "string"
                },
                "prop2": {
                  "type": "string"
                }
              },
              "type": "object"
            },
            "permissions": {
              "0": [
                "set"
              ]
            },
            "type": "entry",
            "value": {
              "prop1": "test value 1",
              "prop2": "test value 2"
            }
          }
        },
        "type": "plugin1"
      }
    },
    "plugin2": {
      "template": {
        "properties": {
          "testlist": {
            "dataSchema": {
              "$id": "characteristics_schema",
              "items": {
                "properties": {
                  "prop1": {
                    "type": "string"
                  },
                  "prop2": {
                    "type": "string"
                  }
                },
                "type": "object"
              },
              "type": "array"
            },
            "permissions": {
              "0": [
                "set"
              ]
            },
            "type": "list"
          }
        },
        "type": "plugin2"
      }
    }
  }
}`);
