import random

from model.country_info import CountryInfo
from model.types import Entity, OwnerEntity
from simulation_utils.info import PersonalInfoGenerator, GeneratedPersonalInfo

def generate_entities(n: int, country_info: CountryInfo | None) -> list[Entity]:

	if n <= 0:
		return []
	person_info_generator = PersonalInfoGenerator(country_info=country_info)
	person_infos = person_info_generator.generate(n=n)
	entities = [
		_create_entity_from_personal_info(person_info=person_info)
		for person_info in person_infos
	]
	return entities

def generate_entity(country_info: CountryInfo | None, is_owner: bool = False) -> Entity | OwnerEntity:
	person_info_generator = PersonalInfoGenerator(country_info=country_info)
	person_info = next(person_info_generator.generate(n=1))
	entity = _create_entity_from_personal_info(person_info=person_info, is_owner=is_owner)
	return entity

def _create_entity_from_personal_info(
		person_info: GeneratedPersonalInfo,
		is_owner: bool = False
) -> Entity | OwnerEntity:
	entity_class = OwnerEntity if is_owner else Entity
	return entity_class(
		first_name=person_info.first_name,
		last_name=person_info.last_name,
		phone=person_info.phone,
		email=person_info.email,
		is_male=random.choices((True, False), weights=(person_info.male_prob, 1 - person_info.male_prob))[0]
	)
