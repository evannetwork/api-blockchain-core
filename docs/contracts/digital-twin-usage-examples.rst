===============================
Digital Twin Usage Examples 
===============================

This section shows a few usage examples that can occur in common digital twin usage scenarios and cover handling of the modules :doc:`DigitalTwin <../contracts/digital-twin>` and :doc:`Container <../contracts/container>`. The examples in here are build around the management of data for heavy construction machines and cover common events link storing data, sharing data, etc.

- *manufacturer*: original manufacturer of the heavy machine
- *customer*: a user, that has bought the physical heavy machine
- *service-technician*: hired by the *customer* to perform maintenance on the heavy machine

The examples in this section use these variables for aforementioned users:

.. code-block:: typescript

  const manufacturer = '0x0000000000000000000000000000000000000001';
  const customer = '0x0000000000000000000000000000000000000002';
  const serviceTechnician = '0x0000000000000000000000000000000000000003';



.. _create-a-digital-twin:

Create a Digital Twin
=========================

Digital Identities are collections of data related to a "thing". A "thing" can be basically anything, a bird, a plane or someone from the planet Krypton. Jokes aside, it most commonly describes a physical object - like in our example here a heavy machine.

So let's create a digital twin four our heavy machine "Big Crane 250", which is done with the |source digitalTwin_create|_ function:

.. code-block:: typescript

    const bigCrane250 = await DigitalTwin.create(runtime, { accountId: manufacturer });

This creates a new digital twin for the account ``manufacturer``, which can now add containers to it or set other properties. 

The |source digitalTwin_create|_ `config` argument function supports more properties than just `accountId`.

You can **and should** give your digital twin a `DBCP <https://dbcp.online/en/home/>`_ description. To do this pass it to the new digital twin in the `config` property.

.. code-block:: typescript

    const description = description: {
      name: 'Big Crane 250',
      description: 'Digital Twin for my heavy machine "Big Crane 250"',
      author: 'Manufacturer',
      version: '0.1.0',
      dbcpVersion: 2,
    };
    const bigCrane250 = await DigitalTwin.create(
      runtime, { accountId: manufacturer, description });

If you do not set a description, at creation time, a default description is set. This description is available at the |source digitalTwin_defaultDescription|_ and can be used as a starting point for your own description. A description can be updated later on as well, see |source digitalTwin_setDescription|_.

So let's say, we have created a digital twin four our heavy machine with the setup from the last code example. We now have the following setup:


.. figure::  ../_static/digital-twin-apidoc-images-1-create.png
   :align:   center
   :alt: manufacturer created a digital twin

   manufacturer created a digital twin



--------------------------------------------------------------------------------

.. _add-containers:

Add Containers to Digital Twin
==================================

Continuing with the digital twin from the last section we add a container, that holds manufacturers private data with information about the production process and a link to a manual file. This can be done with the |source digitalTwin_createContainers|_ function:

.. code-block:: typescript

  const { data } = await bigCrane250.createContainers({
    data: { template: 'metadata' },
  });

The manufacturer account now has created a :doc:`Container <../contracts/container>` instance with the default template ``metadata``. This can be customized as described at |source container_create|_.

.. figure::  ../_static/digital-twin-apidoc-images-2-add-container.png
   :align:   center
   :alt: manufacturer added a container to the twin

   manufacturer added a container to the twin



--------------------------------------------------------------------------------

.. _add-data:

Add Data to the Container
=========================

Continuing the example, the manufacturer adds data to the container.

.. code-block:: typescript

  await data.setEntry(
    'productionProfile',
    {
      id: 'BC250-4711',
      dateOfManufacturing: '1554458858126',
      category: 'hem-c',
    },
  );
  await data.setEntry('manual', 'https://a-link-the-manual...');

As these properties are new, |source container_setEntry|_ adds a role for each property and the owner of the digital twin joins this role. During this role ``0`` to ``63`` are skipped as they are system reserved and can be used for more complex contract role setups. So the roles ``64`` (for ``productionProfile``) and ``65`` (for ``manual``) are created.

For each new property a new encryption key is generated and stored in the contracts :doc:`Sharings <../contracts/sharing>`. When new properties are added, this key is only shared for the owner of the digital twin, so only the owner can access the data stored in the contract.

Data can be read from the containers with |source container_getEntry|_:

.. code-block:: typescript

  const productionProfile = await data.getEntry('productionProfile');

.. figure::  ../_static/digital-twin-apidoc-images-3-add-entries.png
   :align:   center
   :alt: manufacturer added entries to the container

   manufacturer added entries to the container



--------------------------------------------------------------------------------

.. _share-container-properties:

Share Container Properties
==========================

As already said, the manufacturer wants to keep production data for own usage and share a link to the manual to the account ``customer``. When not explicitly shared, properties are kept private, so nothing to do for the field ``productionProfile``. To allow other accounts to access ``manual``, encryption keys have to be shared, which can be done with |source container_shareProperties|_:

.. code-block:: typescript

  await data.shareProperties([
    { accountId: customer, read: ['manual'] }
  ]);

With this call, the account ``customer`` is added to the role ``1`` (member), which allows basic contract interaction but not necessarily access to the data. And because ``manual`` has be specified as a ``read`` (-only) field, this account receives an encryption key for the property ``manual``, so it is now able to read data from this field.

To load data from the twins, ``customer`` can now fetch the container from the digital twin and load its data. Let's assume ``manufacturer`` has communicated the address of the digital twin (e.g. ``0x00000000000000000000000000000000000000c1``) to ``customer`` and the customer can access the link to the manual with:

.. code-block:: typescript

  const bigCrane250LoadedFromCustomer = new DigitalTwin(
    runtime, { accountId: customer, address: '0x00000000000000000000000000000000000000c1' });
  const dataLoadedFromCustomer = await bigCrane250LoadedFromCustomer.getEntry('data');
  const link = await dataLoadedFromCustomer.getEntry('manual');


.. figure::  ../_static/digital-twin-apidoc-images-4-invite-read.png
   :align:   center
   :alt: customer can read entry "manual"

   customer can read entry "manual"



--------------------------------------------------------------------------------

.. _cloning-containers:

Cloning Containers
==================

If ``customer`` wants to re-use data from a data container or an entire data container but have ownership over it, it can clone it and use it in an own digital twin contract. This can be done with |source container_clone|_:

.. code-block:: typescript

  const dataClone = await Container.clone(
    runtime, { accountId: customer }, dataLoadedFromCustomer);

This clone can be linked to a digital twin owner by ``customer``. So let's create a new one and add the clone to it:

.. code-block:: typescript

  const customersDescription = description: {
      name: 'My own Big Crane 250',
      description: 'I bought a Big Crane 250 and this is my collection of data for it',
      author: 'Customer',
      version: '0.1.0',
      dbcpVersion: 2,
    };
    const customersBigCrane250 = await DigitalTwin.create(
      runtime, { accountId: customer, description: customersDescription });

    await customersBigCrane250.setEntry(
      'machine-data',
      dataClone,
      DigitalTwinEntryType.ContainerContract,
    );

Note that the container is not named ``data`` like in the original twin but called ``machine-data`` here. Names can be reassigned as desired.

.. figure::  ../_static/digital-twin-apidoc-images-5-clone.png
   :align:   center
   :alt: customer cloned data container

   customer cloned data container



--------------------------------------------------------------------------------

.. _granting-write-access:

Granting Write Access
=====================

Properties at :doc:`Containers <../contracts/container>` can be "entries" as used in the last examples or "list entries". To add data to lists call |source container_addListEntries|_:

.. code-block:: typescript

  await dataClone.addListEntries(
    'usagelog',
    [ 'I started using my net Big Crane 250' ]
  );

Now ``customer`` wants to invite ``serviceTechnician`` and allow this account to add entries to the list ``usagelog`` as well. To do this, the list is shared the same way as in the previous example, but the field is shared as ``readWrite``:

.. code-block:: typescript

  await dataClone.shareProperties([
    { accountId: customer, readWrite: ['usagelog'] }
  ]);

``serviceTechnician`` can now write to the list ``usagelog`` and we now have the following setup:

.. figure::  ../_static/digital-twin-apidoc-images-6-invite-write.png
   :align:   center
   :alt: customer invited service technician

   customer invited service technician



--------------------------------------------------------------------------------

.. required for building markup

.. |source container_addListEntries| replace:: ``container.addListEntries``
.. _source container_addListEntries: ../contracts/container.html#addlistentries

.. |source container_clone| replace:: ``container.clone``
.. _source container_clone: ../contracts/container.html#clone

.. |source container_create| replace:: ``container.create``
.. _source container_create: ../contracts/container.html#create

.. |source container_getEntry| replace:: ``container.getEntry``
.. _source container_getEntry: ../contracts/container.html#getentry

.. |source container_setEntry| replace:: ``container.setEntry``
.. _source container_setEntry: ../contracts/container.html#setentry

.. |source container_shareProperties| replace:: ``container.shareProperties``
.. _source container_shareProperties: ../contracts/container.html#shareproperties

.. |source digitalTwin_create| replace:: ``digitalTwin.create``
.. _source digitalTwin_create: ../contracts/digital-twin.html#create

.. |source digitalTwin_createContainers| replace:: ``digitalTwin.createContainers``
.. _source digitalTwin_createContainers: ../contracts/digital-twin.html#createcontainers

.. |source digitalTwin_defaultDescription| replace:: ``digitalTwin.defaultDescription``
.. _source digitalTwin_defaultDescription: ../contracts/digital-twin.html#defaultdescription

.. |source digitalTwin_setDescription| replace:: ``digitalTwin.setDescription``
.. _source digitalTwin_setDescription: ../contracts/digital-twin.html#setdescription
