======================
Identity Based Profile
======================

On the evan.network a profile is simply a [data contract](https://evannetwork.github.io/docs/developers/concepts/data-contract.html). The data can be initialy by the owner of the profile but when [permissions](https://evannetwork.github.io/docs/developers/concepts/smart-contract-permissioning.html) are granted other members can also the data. Similarly to under stand what an identity based profile is we need to look into roles and permissions. An identity based profile is also a data contract but the owner of the data contract is another contract which we shall call the identity contract.

![Idenitity_based_profile](./docu/img/Identity_based_profile.png)

When an account requests for an identity based profile, A random 32 bytes address(profile) is generated and this is then linked to the identity and this is mapped to the account which becomes the owner of this identity based profile. All functionalities are provided using the IdentityHolder contract. Once this identity based profile has been created then this profile is added to the user registry.