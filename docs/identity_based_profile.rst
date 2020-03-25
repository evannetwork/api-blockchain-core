======================
Identity Based Profile
======================

On the evan.network a profile is simply a `data contract <https://evannetwork.github.io/docs/developers/concepts/data-contract.html>_. The data can be initialy by the owner of the profile but when `permissions <https://evannetwork.github.io/docs/developers/concepts/smart-contract-permissioning.html>` are granted other members can also the data. Similarly to under stand what an identity based profile is we need to look into roles and permissions. An identity based profile is also a data contract but the owner of the data contract is another contract which we shall call the identity contract.

.. figure::  ../docu/img/identity_based_profile.png
   :align:   center
   :alt: identity based profile
   
   identity based profile

When an account requests for an identity based profile, A random 32 bytes address(profile) is generated and this is then linked to the identity and this is mapped to the account which becomes the owner of this identity based profile. All functionalities generating address, linking the identity and mapping the owner are provided using the IdentityHolder contract. Once this identity based profile has been created then this profile is added to the user registry.

When using identities we will come accross three important terminologies. `activeIdentity` and `underlyingAccount` and `activeAccount`. A single user can have multiple identities and the identity being used is known as the activeIdentity. The account which is used to execute the transaction for the identity is known as the underlyingAccount. Finally multiple accounts can delegate a single identity and the account which is using the identity is known as the activeAccount.

Further more these identities can be converted into DIDs using the :doc:`DID <did>` module and they can issue and be issued verifiable credentials using the :doc:`VC <vc>` module.